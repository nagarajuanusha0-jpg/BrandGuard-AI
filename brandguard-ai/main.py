"""
BrandGuard AI - Round 3 evidence-grounded analysis service.

Compatible with the existing backend:
POST /extract   multipart field: file
POST /analyze   JSON fields:
  content, prohibited_terms, required_terms,
  approved_tone_rules, term_replacements

Optional revision comparison fields:
  previous_findings: list of findings from the previous revision
  revision_number: current revision number

The service is deterministic and rule-based. It does not make final approval
decisions. Human reviewers retain approval authority.
"""

from __future__ import annotations

import hashlib
import re
from collections import Counter
from typing import Any, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, Field

from document_extractor import extract_document_text, DocumentExtractionError


app = FastAPI(
    title="BrandGuard AI",
    description=(
        "Evidence-grounded brand guideline analysis, explainable findings, "
        "revision comparison and document extraction."
    ),
    version="3.0.0",
)

MAX_UPLOAD_BYTES = 15 * 1024 * 1024

CASUAL_REPLACEMENTS: dict[str, str] = {
    "dude": "Remove the informal expression",
    "awesome": "excellent",
    "super cool": "impressive",
    "gonna": "going to",
    "wanna": "want to",
    "gotta": "have to",
    "yep": "yes",
    "yeah": "yes",
    "stuff": "items",
    "kids": "children",
    "cheap": "affordable",
    "best ever": "highly regarded",
    "hey guys": "Hello everyone",
    "unbelievable": "noteworthy",
    "kinda": "somewhat",
    "sorta": "somewhat",
    "omg": "Remove the informal expression",
    "lol": "Remove the informal expression",
}

CLAIM_PATTERNS: list[tuple[str, str, str]] = [
    (
        r"\b100\s*%\s*(?:customer\s+)?satisfaction\b",
        "Absolute satisfaction claim",
        "An absolute satisfaction statement needs reliable approved supporting evidence and clear measurement conditions.",
    ),
    (
        r"\b(?:guarantee|guarantees|guaranteed)\b.{0,140}\b(?:results?|success|satisfaction|performance|sales|growth|savings?)\b",
        "Guarantee claim",
        "A guarantee about outcomes should be supported by approved evidence and its terms and conditions.",
    ),
    (
        r"\b(?:the\s+)?best\b.{0,90}\b(?:market|world|industry|available|ever|product|service)\b",
        "Superiority claim",
        "A superiority statement may require current comparative evidence and a clearly defined basis of comparison.",
    ),
    (
        r"\b(?:number\s+one|no\.?\s*1|world['’]s\s+best|market\s+leader|leading\s+brand)\b",
        "Ranking or leadership claim",
        "A ranking or market-leadership statement needs current, verifiable evidence and a defined market or category.",
    ),
    (
        r"\b(?:has\s+no\s+(?:competitors?|competition)|no\s+competitors?|no\s+competing\s+(?:brands?|companies|products?)|the\s+only\s+(?:brand|company|product|service)\b.{0,80}\b(?:in|on|for|of)\b|the\s+only\s+(?:one|product|service)\s+of\s+its\s+kind)\b",
        "Exclusivity claim",
        "An exclusivity statement should be checked against reliable competitor and market evidence.",
    ),
    (
        r"\b(?:unmatched|unrivaled|unrivalled|revolutionary|world[- ]class|one[- ]of[- ]a[- ]kind)\b",
        "Strong promotional claim",
        "This strong promotional wording may imply a measurable or comparative claim that needs evidence.",
    ),
    (
        r"\b(?:clinically\s+proven|scientifically\s+proven|proven\s+to\s+(?:cure|treat|prevent)|100\s*%\s+effective)\b",
        "Scientific or efficacy claim",
        "Scientific, clinical or effectiveness claims require appropriate evidence and approval.",
    ),
    (
        r"\b(?:zero\s+risk|risk[- ]free|no\s+side\s+effects|completely\s+safe)\b",
        "Absolute safety claim",
        "An absolute safety statement needs strong, relevant evidence and may require specialist review.",
    ),
]

TONE_KEYWORDS = (
    "tone", "professional", "formal", "informal", "casual", "respectful",
    "language", "communication", "expression", "slang", "voice",
    "brand personality", "writing style",
)

CLAIM_POLICY_KEYWORDS = (
    "unsupported claims", "supporting evidence", "verified information",
    "verified facts", "factual claims", "substantiated claims",
    "claims must be verified", "evidence-based claims", "approved facts",
    "factual accuracy", "must be supported", "claims must be supported",
)


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    content: str = Field(min_length=1)
    prohibited_terms: list[str] = Field(default_factory=list)
    required_terms: list[str] = Field(default_factory=list)
    approved_tone_rules: list[str] = Field(default_factory=list)
    term_replacements: dict[str, str] = Field(default_factory=dict)

    # Optional fields used when the backend supplies prior revision findings.
    previous_findings: list[dict[str, Any]] = Field(default_factory=list)
    revision_number: Optional[int] = None


def clean(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def dedupe_strings(values: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        item = clean(value)
        key = item.casefold()
        if item and key not in seen:
            seen.add(key)
            result.append(item)
    return result


def find_terms(content: str, term: str) -> list[re.Match[str]]:
    term = clean(term)
    if not term:
        return []
    pattern = r"(?<!\w)" + re.escape(term) + r"(?!\w)"
    return list(re.finditer(pattern, content, flags=re.IGNORECASE))


def find_term(content: str, term: str) -> Optional[re.Match[str]]:
    matches = find_terms(content, term)
    return matches[0] if matches else None


def sentence_excerpt(content: str, start: Optional[int], end: Optional[int]) -> str:
    """Return evidence from the submitted content, never from the guideline."""
    if start is None or end is None:
        return ""
    left_bound = max(0, start - 180)
    right_bound = min(len(content), end + 180)
    left_candidates = [
        content.rfind(mark, left_bound, start)
        for mark in (".", "!", "?", "\n")
    ]
    left = max(left_candidates)
    right_candidates = [
        pos for pos in (
            content.find(".", end, right_bound),
            content.find("!", end, right_bound),
            content.find("?", end, right_bound),
            content.find("\n", end, right_bound),
        ) if pos >= 0
    ]
    actual_left = left + 1 if left >= 0 else left_bound
    actual_right = min(right_candidates) + 1 if right_candidates else right_bound
    excerpt = re.sub(r"\s+", " ", content[actual_left:actual_right]).strip()
    return excerpt[:497].rstrip() + "..." if len(excerpt) > 500 else excerpt


def rule_metadata(rule: str) -> dict[str, str]:
    def capture(pattern: str, fallback: str = "") -> str:
        match = re.search(pattern, rule, flags=re.IGNORECASE | re.MULTILINE)
        return match.group(1).strip() if match else fallback

    return {
        "title": capture(r"^\s*Guideline:\s*(.+)$", "Uploaded guideline"),
        "category": capture(r"^\s*Category:\s*(.+)$", "Brand Guidelines"),
        "filename": capture(r"^\s*(?:Attached Document|Document):\s*(.+)$"),
    }


def source_label(rule: str) -> str:
    meta = rule_metadata(rule)
    label = f"Admin guideline: {meta['title']} ({meta['category']})"
    if meta["filename"]:
        label += f" — {meta['filename']}"
    return label


def all_guideline_text(guidelines: list[str]) -> str:
    return "\n\n".join(guidelines)


def explicit_rule_evidence(rule: str, term: str = "") -> str:
    """Return a short matching instruction, not the whole attached document."""
    if not rule:
        return ""
    lines = [line.strip() for line in rule.splitlines() if line.strip()]
    if term:
        for line in lines:
            if term.casefold() in line.casefold():
                return line[:350]
    for line in lines:
        lowered = line.casefold()
        if any(word in lowered for word in (
            "official brand", "must use", "do not use", "prohibited",
            "required", "tone", "claims", "approved", "replacement",
        )):
            return line[:350]
    return (lines[-1] if lines else rule)[:350]


def extract_explicit_terms(guideline_text: str, label_pattern: str) -> list[str]:
    terms: list[str] = []
    pattern = rf"(?im)^\s*(?:{label_pattern})\s*:\s*([^\n]+)"
    for match in re.finditer(pattern, guideline_text):
        for item in re.split(r"[,;|]", match.group(1)):
            term = item.strip(" \t.'\"-")
            if term and term.casefold() not in {x.casefold() for x in terms}:
                terms.append(term)
    return terms


def extract_explicit_replacements(guideline_text: str) -> dict[str, str]:
    result: dict[str, str] = {}
    patterns = [
        (0, r"\breplace\s+['\"]?([^'\"\n,;]+?)['\"]?\s+with\s+['\"]?([^'\"\n,;.!]+)"),
        (1, r"\buse\s+['\"]?([^'\"\n,;.!]+?)['\"]?\s+instead\s+of\s+['\"]?([^'\"\n,;.!]+)"),
    ]
    for direction, pattern in patterns:
        for match in re.finditer(pattern, guideline_text, flags=re.IGNORECASE):
            old, new = (
                (match.group(1).strip(), match.group(2).strip())
                if direction == 0
                else (match.group(2).strip(), match.group(1).strip())
            )
            if old and new and len(old) <= 80 and len(new) <= 80:
                result[old] = new
    return result


def find_rule_for_term(guidelines: list[str], term: str) -> str:
    for rule in guidelines:
        if term.casefold() in rule.casefold():
            return rule
    return guidelines[0] if guidelines else ""


def extract_official_brand_names(guideline_text: str) -> list[str]:
    patterns = [
        r"\bofficial\s+brand\s+name\s*(?::|\bis\b)\s*['\"“]?([A-Z][A-Za-z0-9&._-]*)",
        r"\bofficial\s+name\s*(?::|\bis\b)\s*['\"“]?([A-Z][A-Za-z0-9&._-]*)",
        r"\bbrand\s+name\s*(?::|\bis\b|\bmust\s+be\b)\s*['\"“]?([A-Z][A-Za-z0-9&._-]*)",
    ]
    names: list[str] = []
    for pattern in patterns:
        for match in re.finditer(pattern, guideline_text, flags=re.IGNORECASE):
            name = match.group(1).strip(".,;:()[]{}'\"“”")
            if name and name.casefold() not in {x.casefold() for x in names}:
                names.append(name)
    return names


def brand_name_parts(name: str) -> list[str]:
    parts = re.findall(r"[A-Z]+(?=[A-Z][a-z]|\b)|[A-Z]?[a-z]+|\d+", name)
    return parts if len(parts) > 1 else []


def brand_name_mismatches(content: str, official_name: str) -> list[re.Match[str]]:
    parts = brand_name_parts(official_name)
    if not parts:
        return []
    spaced = r"\b" + r"\s+".join(re.escape(part) for part in parts) + r"\b"
    return [
        match for match in re.finditer(spaced, content, flags=re.IGNORECASE)
        if match.group(0).casefold() != official_name.casefold()
    ]


def is_tone_guideline(rule: str) -> bool:
    lowered = rule.casefold()
    return any(keyword in lowered for keyword in TONE_KEYWORDS)


def claim_policy_active(guideline_text: str) -> bool:
    lowered = guideline_text.casefold()
    return any(keyword in lowered for keyword in CLAIM_POLICY_KEYWORDS)


def find_claim_policy_rule(guidelines: list[str]) -> str:
    keywords = (
        "unsupported claims", "verified claims", "claims must be supported",
        "supported by evidence", "approved facts", "verified information",
        "supporting evidence", "must be supported",
    )
    for guideline in guidelines:
        for line in guideline.splitlines():
            if any(keyword in line.casefold() for keyword in keywords):
                return guideline
    return ""


def generate_rule_id(category: str, source: str) -> str:
    normalized = re.sub(r"\s+", " ", f"{category}|{source}".strip()).casefold()
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:12].upper()
    return f"BG-{digest}"


def add_finding(
    findings: list[dict[str, Any]],
    *,
    issue: str,
    severity: str,
    category: str,
    source: str,
    reason: str,
    suggestion: str,
    content: str,
    start: Optional[int] = None,
    end: Optional[int] = None,
    confidence: str = "medium",
    evidence_type: str = "guideline_match",
    guideline_evidence: str = "",
    rule_id: str = "",
) -> None:
    position = (
        {"start": start, "end": end}
        if start is not None and end is not None else None
    )
    submitted_evidence = sentence_excerpt(content, start, end)
    resolved_rule_id = rule_id or generate_rule_id(category, source)

    # Preserve legacy field names consumed by the current Node backend.
    findings.append({
        "issue": issue,
        "severity": severity,
        "source": source,
        "reason": reason,
        "suggestion": suggestion,
        "position": position,

        # Explainability fields. "excerpt" is always submitted-content evidence.
        "category": category,
        "excerpt": submitted_evidence,
        "original_excerpt": submitted_evidence,
        "evidence_excerpt": submitted_evidence,
        "submitted_evidence": submitted_evidence,
        "guideline_evidence": guideline_evidence[:500],
        "guideline_reference": source,
        "confidence": confidence,
        "evidence_type": evidence_type,
        "rule_id": resolved_rule_id,
    })


def append_term_findings(
    findings: list[dict[str, Any]],
    *,
    content: str,
    term: str,
    issue: str,
    severity: str,
    category: str,
    source: str,
    reason: str,
    suggestion: str,
    confidence: str,
    evidence_type: str,
    guideline_evidence: str = "",
) -> None:
    for match in find_terms(content, term):
        add_finding(
            findings,
            issue=issue,
            severity=severity,
            category=category,
            source=source,
            reason=reason,
            suggestion=suggestion,
            content=content,
            start=match.start(),
            end=match.end(),
            confidence=confidence,
            evidence_type=evidence_type,
            guideline_evidence=guideline_evidence,
        )


def deduplicate_findings(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Collapse repeated rule detections for the same issue at the same text range.
    Separate occurrences at different positions are intentionally preserved.
    """
    unique: list[dict[str, Any]] = []
    seen: set[tuple[Any, ...]] = set()

    for item in findings:
        position = item.get("position") or {}
        normalized_issue = re.sub(r"\s+", " ", clean(item.get("issue"))).casefold()
        normalized_category = clean(item.get("category")).casefold()
        start = position.get("start")
        end = position.get("end")

        # If a finding has no position, use its issue/category/rule identity.
        key = (
            normalized_issue,
            normalized_category,
            start,
            end,
        )
        if key not in seen:
            seen.add(key)
            unique.append(item)

    return unique


def calculate_score(findings: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Transparent indicative score:
      violation: -25 points per distinct violation
      concern: -8 points per distinct concern unit
    Overlapping concern ranges in the same category count once.
    The score is not an approval decision.
    """
    violations = [f for f in findings if f.get("severity") == "violation"]
    concerns = [f for f in findings if f.get("severity") == "concern"]

    violation_deduction = len(violations) * 25
    grouped: dict[str, list[dict[str, Any]]] = {}
    for item in concerns:
        grouped.setdefault(clean(item.get("category")) or "General", []).append(item)

    concern_units = 0
    for category_items in grouped.values():
        ranges: list[tuple[int, int]] = []
        unpositioned = 0

        for item in category_items:
            position = item.get("position") or {}
            start, end = position.get("start"), position.get("end")
            if isinstance(start, int) and isinstance(end, int):
                ranges.append((start, end))
            else:
                unpositioned += 1

        merged: list[tuple[int, int]] = []
        for current in sorted(ranges, key=lambda pair: pair[0]):
            if merged and current[0] <= merged[-1][1]:
                merged[-1] = (merged[-1][0], max(merged[-1][1], current[1]))
            else:
                merged.append(current)

        concern_units += len(merged) + unpositioned

    concern_deduction = concern_units * 8
    score = max(0, min(100, 100 - violation_deduction - concern_deduction))

    return {
        "score": score,
        "base_score": 100,
        "violation_count": len(violations),
        "violation_deduction_each": 25,
        "violation_deduction": violation_deduction,
        "concern_units": concern_units,
        "concern_deduction_each": 8,
        "concern_deduction": concern_deduction,
        "formula": "100 - (25 × violations) - (8 × concern units), minimum 0",
        "is_indicative": True,
    }


def finding_signature(item: dict[str, Any]) -> tuple[str, str, str]:
    issue = re.sub(r"\s+", " ", clean(item.get("issue"))).casefold()
    category = clean(item.get("category")).casefold()
    evidence = re.sub(
        r"\s+", " ",
        clean(
            item.get("submitted_evidence")
            or item.get("excerpt")
            or item.get("originalExcerpt")
            or item.get("original_excerpt")
        ),
    ).casefold()
    return issue, category, evidence


def compare_revisions(
    current_findings: list[dict[str, Any]],
    previous_findings: list[dict[str, Any]],
    revision_number: Optional[int],
) -> dict[str, Any]:
    """
    Compare the current analysis with findings supplied for the prior revision.
    If no prior findings are supplied, report that comparison is unavailable.
    """
    if not previous_findings:
        return {
            "available": False,
            "revision_number": revision_number,
            "previous_revision_findings": 0,
            "new_findings": len(current_findings),
            "resolved_findings": 0,
            "recurring_findings": 0,
            "message": (
                "Previous revision findings were not supplied by the backend; "
                "cross-revision comparison is not available for this analysis."
            ),
            "new": [],
            "resolved": [],
            "recurring": [],
        }

    previous_map: dict[tuple[str, str, str], dict[str, Any]] = {}
    current_map: dict[tuple[str, str, str], dict[str, Any]] = {}

    for item in previous_findings:
        previous_map.setdefault(finding_signature(item), item)
    for item in current_findings:
        current_map.setdefault(finding_signature(item), item)

    previous_keys = set(previous_map)
    current_keys = set(current_map)

    new_keys = current_keys - previous_keys
    resolved_keys = previous_keys - current_keys
    recurring_keys = current_keys & previous_keys

    def compact(item: dict[str, Any]) -> dict[str, Any]:
        return {
            "issue": item.get("issue", ""),
            "category": item.get("category", ""),
            "severity": item.get("severity", ""),
            "evidence": (
                item.get("submitted_evidence")
                or item.get("excerpt")
                or item.get("original_excerpt")
                or ""
            ),
        }

    return {
        "available": True,
        "revision_number": revision_number,
        "previous_revision_findings": len(previous_findings),
        "new_findings": len(new_keys),
        "resolved_findings": len(resolved_keys),
        "recurring_findings": len(recurring_keys),
        "message": "Revision comparison is based on the findings supplied by the backend.",
        "new": [compact(current_map[key]) for key in sorted(new_keys)],
        "resolved": [compact(previous_map[key]) for key in sorted(resolved_keys)],
        "recurring": [compact(current_map[key]) for key in sorted(recurring_keys)],
    }


@app.get("/")
def home():
    return {
        "message": "Welcome to BrandGuard AI",
        "status": "Running successfully",
        "version": app.version,
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "BrandGuard AI",
        "version": app.version,
    }


@app.post("/extract")
async def extract_document(file: UploadFile = File(...)):
    filename = file.filename or ""
    try:
        file_bytes = await file.read(MAX_UPLOAD_BYTES + 1)
        if len(file_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail="File exceeds the 15 MB upload limit.",
            )
        if not filename:
            raise HTTPException(status_code=400, detail="A filename is required.")

        result = extract_document_text(file_bytes, filename)
        return {"success": True, **result}

    except DocumentExtractionError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    finally:
        await file.close()


@app.post("/analyze")
def analyze_content(request: AnalyzeRequest):
    content = request.content
    if not content.strip():
        raise HTTPException(
            status_code=400,
            detail="Content to analyze cannot be empty.",
        )

    findings: list[dict[str, Any]] = []
    guidelines = dedupe_strings([
        clean(item) for item in request.approved_tone_rules if clean(item)
    ])
    guideline_text = all_guideline_text(guidelines)

    extracted_prohibited = extract_explicit_terms(
        guideline_text,
        r"prohibited\s+terms|forbidden\s+terms|do\s+not\s+use",
    )
    extracted_required = extract_explicit_terms(
        guideline_text,
        r"required\s+terms|must\s+include|mandatory\s+terms",
    )
    extracted_replacements = extract_explicit_replacements(guideline_text)

    prohibited_terms = dedupe_strings(
        list(request.prohibited_terms) + extracted_prohibited
    )
    required_terms = dedupe_strings(
        list(request.required_terms) + extracted_required
    )
    replacements = {
        **extracted_replacements,
        **request.term_replacements,
    }

    # 1. Official brand-name formatting.
    official_names = extract_official_brand_names(guideline_text)
    for official_name in official_names:
        for match in brand_name_mismatches(content, official_name):
            rule = find_rule_for_term(guidelines, official_name)
            add_finding(
                findings,
                issue=f"Incorrect brand name formatting: {match.group(0)}",
                severity="violation",
                category="Brand Identity",
                source=source_label(rule) if rule else "Admin guideline: official brand name",
                reason=(
                    f"The approved guideline identifies '{official_name}' "
                    "as the official brand name."
                ),
                suggestion=f"Use the official brand name '{official_name}'.",
                content=content,
                start=match.start(),
                end=match.end(),
                confidence="high",
                evidence_type="explicit_rule",
                guideline_evidence=explicit_rule_evidence(rule, official_name),
            )

    # 2. Explicit prohibited terminology.
    for term in prohibited_terms:
        rule = find_rule_for_term(guidelines, term)
        replacement = replacements.get(term)
        if not replacement:
            replacement = next(
                (
                    value for key, value in CASUAL_REPLACEMENTS.items()
                    if key.casefold() == term.casefold()
                ),
                "",
            )
        suggestion = (
            f"Replace '{term}' with '{replacement}'."
            if replacement
            else f"Remove '{term}' or replace it with approved brand wording."
        )
        append_term_findings(
            findings,
            content=content,
            term=term,
            issue=f"Prohibited term found: {term}",
            severity="violation",
            category="Terminology",
            source=source_label(rule) if rule else "Admin guideline: prohibited terms",
            reason=f"The approved rules explicitly identify '{term}' as prohibited.",
            suggestion=suggestion,
            confidence="high",
            evidence_type="explicit_rule",
            guideline_evidence=explicit_rule_evidence(rule, term),
        )

    # 3. Tone checks only run when an approved tone rule exists.
    tone_guidelines = [rule for rule in guidelines if is_tone_guideline(rule)]
    if tone_guidelines:
        tone_rule = tone_guidelines[0]
        for expression, replacement in CASUAL_REPLACEMENTS.items():
            for match in find_terms(content, expression):
                add_finding(
                    findings,
                    issue=f"Tone guideline concern: {match.group(0)}",
                    severity="concern",
                    category="Tone",
                    source=source_label(tone_rule),
                    reason=(
                        f"'{match.group(0)}' may be too informal for the tone "
                        "guidance. Review the surrounding sentence and audience."
                    ),
                    suggestion=(
                        f"Consider replacing '{match.group(0)}' with "
                        f"'{replacement}'. Preserve the intended meaning."
                    ),
                    content=content,
                    start=match.start(),
                    end=match.end(),
                    confidence="medium",
                    evidence_type="heuristic_tone",
                    guideline_evidence=explicit_rule_evidence(tone_rule),
                )

    # 4. Explicit terminology replacements.
    prohibited_lookup = {term.casefold() for term in prohibited_terms}
    for term, replacement in replacements.items():
        if term.casefold() in prohibited_lookup:
            continue
        rule = find_rule_for_term(guidelines, term)
        for match in find_terms(content, term):
            add_finding(
                findings,
                issue=f"Preferred terminology: {term}",
                severity="concern",
                category="Terminology",
                source=source_label(rule) if rule else "Admin guideline: approved terminology",
                reason=(
                    f"The configured terminology rule prefers '{replacement}' "
                    f"instead of '{term}'."
                ),
                suggestion=f"Replace '{term}' with '{replacement}' where appropriate.",
                content=content,
                start=match.start(),
                end=match.end(),
                confidence="high",
                evidence_type="explicit_replacement",
                guideline_evidence=explicit_rule_evidence(rule, term),
            )

    # 5. Required terms.
    for term in required_terms:
        if find_term(content, term):
            continue

        already_reported_brand_mismatch = any(
            term.casefold() == official.casefold()
            and brand_name_mismatches(content, official)
            for official in official_names
        )
        if already_reported_brand_mismatch:
            continue

        rule = find_rule_for_term(guidelines, term)
        add_finding(
            findings,
            issue=f"Required term missing: {term}",
            severity="concern",
            category="Terminology",
            source=source_label(rule) if rule else "Admin guideline: required terms",
            reason=(
                f"The approved rules list '{term}' as required, "
                "but it was not found in the submission."
            ),
            suggestion=(
                f"Include '{term}' if relevant and if it can be added "
                "without making the message misleading."
            ),
            content=content,
            confidence="high",
            evidence_type="explicit_requirement",
            guideline_evidence=explicit_rule_evidence(rule, term),
        )

    # 6. Potentially unsupported claims. These are review prompts, not proof.
    if claim_policy_active(guideline_text):
        claim_rule = find_claim_policy_rule(guidelines)
        for pattern, label, explanation in CLAIM_PATTERNS:
            for match in re.finditer(pattern, content, flags=re.IGNORECASE):
                add_finding(
                    findings,
                    issue=f"Potentially unsupported claim: {label}",
                    severity="concern",
                    category="Brand Facts and Claims",
                    source=(
                        source_label(claim_rule)
                        if claim_rule
                        else "Admin guideline: claims must be supported by approved facts"
                    ),
                    reason=(
                        f"{explanation} The analyzer has not established that "
                        "the statement is false; a human reviewer should verify it."
                    ),
                    suggestion=(
                        "Verify the statement against an approved fact or source. "
                        "If evidence is unavailable, narrow or remove the claim."
                    ),
                    content=content,
                    start=match.start(),
                    end=match.end(),
                    confidence="low",
                    evidence_type="requires_fact_verification",
                    guideline_evidence=explicit_rule_evidence(claim_rule),
                )

    # Remove repeated detections at the same text location, retaining separate
    # occurrences when the same issue genuinely appears in different locations.
    findings = deduplicate_findings(findings)

    score_details = calculate_score(findings)
    violations = sum(1 for item in findings if item["severity"] == "violation")
    concerns = sum(1 for item in findings if item["severity"] == "concern")
    category_counts = dict(Counter(item["category"] for item in findings))

    revision_intelligence = compare_revisions(
        findings,
        request.previous_findings,
        request.revision_number,
    )

    return {
        "status": "analysis_completed",
        "compliance_score": score_details["score"],
        "total_issues": len(findings),
        "findings": findings,
        "approval_decision": "Not determined",
        "score_breakdown": score_details,
        "revision_intelligence": revision_intelligence,
        "summary": {
            "violations": violations,
            "concerns": concerns,
            "guidelines_received": len(guidelines),
            "official_brand_names_detected": official_names,
            "findings_by_category": category_counts,
            "analysis_mode": "deterministic_evidence_grounded",
            "revision_comparison_available": revision_intelligence["available"],
            "limitations": [
                "The analyzer checks explicit rules and supported language patterns; it does not understand every semantic instruction.",
                "Potentially unsupported claims require human verification and are not treated as proven false.",
                "Revision comparison requires the backend to supply previous revision findings.",
                "The compliance score is indicative and does not make an approval decision.",
                "Scanned pages, images, diagrams and visual brand assets are not analyzed by this text-only pipeline.",
            ],
        },
    }
