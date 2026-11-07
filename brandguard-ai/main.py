
import re
from fastapi import FastAPI
from pydantic import BaseModel, Field


app = FastAPI(
    title="BrandGuard AI",
    description="AI-powered Brand Protection Service",
    version="1.0.0"
)


# --------------------------------
# REQUEST MODEL
# --------------------------------

class AnalyzeRequest(BaseModel):
    content: str
    prohibited_terms: list[str] = Field(default_factory=list)
    required_terms: list[str] = Field(default_factory=list)
    approved_tone_rules: list[str] = Field(default_factory=list)
    term_replacements: dict[str, str] = Field(default_factory=dict)


# --------------------------------
# TONE REPLACEMENT DICTIONARY
# --------------------------------

# Rule-based fallback: these are examples of
# professional replacements for common expressions.

CASUAL_REPLACEMENTS = {
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
    "best ever": "highly recommended"
}


# --------------------------------
# HELPER FUNCTIONS
# --------------------------------

def find_term(content: str, term: str):
    """Find the first whole-word occurrence of a term."""

    if not term or not term.strip():
        return None

    pattern = r"(?<!\w)" + re.escape(term) + r"(?!\w)"

    return re.search(pattern, content, re.IGNORECASE)


def get_replacement(term: str, replacements: dict):
    """Find an approved replacement without case sensitivity."""

    for key, value in replacements.items():
        if key.casefold() == term.casefold():
            return value

    for key, value in CASUAL_REPLACEMENTS.items():
        if key.casefold() == term.casefold():
            return value

    return (
        f"Review '{term}' and replace it with wording "
        "that follows the Admin's brand guidelines."
    )


def get_guideline_category(rule: str):
    """Identify the guideline category."""

    text = rule.casefold()

    if "terminology" in text:
        return "Terminology"

    if "brand facts" in text:
        return "Brand Facts"

    if "brand guidelines" in text:
        return "Brand Guidelines"

    return "Admin Guidelines"


def is_tone_guideline(rule: str):
    """Check whether a guideline appears to concern tone."""

    keywords = [
        "tone",
        "professional",
        "formal",
        "informal",
        "casual",
        "respectful",
        "language",
        "communication",
        "expression",
        "slang"
    ]

    text = rule.casefold()

    return any(word in text for word in keywords)


# --------------------------------
# HOME ENDPOINT
# --------------------------------

@app.get("/")
def home():
    return {
        "message": "Welcome to BrandGuard AI",
        "status": "Running successfully"
    }


# --------------------------------
# HEALTH ENDPOINT
# --------------------------------

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "BrandGuard AI"
    }


# --------------------------------
# BRAND CONTENT ANALYSIS
# --------------------------------

@app.post("/analyze")
def analyze_content(request: AnalyzeRequest):

    findings = []
    content = request.content

    # --------------------------------
    # 1. PROHIBITED TERMS CHECK
    # --------------------------------

    for term in request.prohibited_terms:

        match = find_term(content, term)

        if match:

            replacement = get_replacement(
                term,
                request.term_replacements
            )

            findings.append({
                "issue": f"Prohibited term found: {term}",
                "severity": "violation",
                "source": "Brand guideline: prohibited terms",
                "reason": (
                    f"The term '{term}' is not allowed "
                    "by the supplied guidelines."
                ),
                "suggestion": (
                    f"Replace '{term}' with '{replacement}'."
                ),
                "position": {
                    "start": match.start(),
                    "end": match.end()
                }
            })

    # --------------------------------
    # 2. ADMIN GUIDELINE CHECK
    # --------------------------------

    active_tone_guidelines = [
        rule for rule in request.approved_tone_rules
        if is_tone_guideline(rule)
    ]

    # Apply known expression checks only when
    # Admin has supplied a tone-related guideline.

    if active_tone_guidelines:

        for word, replacement in CASUAL_REPLACEMENTS.items():

            match = find_term(content, word)

            if match:

                findings.append({
                    "issue": f"Tone guideline concern: {word}",
                    "severity": "concern",
                    "source": "Admin: Approved tone guidelines",
                    "reason": (
                        f"The expression '{word}' may not follow "
                        "the active Admin tone guidelines: "
                        + "; ".join(active_tone_guidelines)
                    ),
                    "suggestion": (
                        f"Replace '{word}' with '{replacement}'."
                    ),
                    "position": {
                        "start": match.start(),
                        "end": match.end()
                    }
                })

    # --------------------------------
    # 3. TERMINOLOGY GUIDELINE CHECK
    # --------------------------------

    terminology_guidelines = [
        rule for rule in request.approved_tone_rules
        if "terminology" in rule.casefold()
    ]

    # Check explicit replacements supplied by backend.

    for term, replacement in request.term_replacements.items():

        match = find_term(content, term)

        if match:

            # Avoid duplicate findings for the same word.
            already_found = any(
                finding["position"] is not None
                and finding["position"]["start"] == match.start()
                and finding["position"]["end"] == match.end()
                for finding in findings
            )

            if not already_found:

                findings.append({
                    "issue": f"Terminology guideline concern: {term}",
                    "severity": "concern",
                    "source": "Admin: Terminology guidelines",
                    "reason": (
                        "This term has an approved replacement "
                        "configured for the brand."
                    ),
                    "suggestion": (
                        f"Replace '{term}' with '{replacement}'."
                    ),
                    "position": {
                        "start": match.start(),
                        "end": match.end()
                    }
                })

    # --------------------------------
    # 4. REQUIRED TERMS CHECK
    # --------------------------------

    for term in request.required_terms:

        match = find_term(content, term)

        if not match:

            findings.append({
                "issue": f"Required term missing: {term}",
                "severity": "concern",
                "source": "Brand guideline: required terms",
                "reason": (
                    f"The required term '{term}' is missing."
                ),
                "suggestion": (
                    f"Consider including '{term}' where appropriate."
                ),
                "position": None
            })

    # --------------------------------
    # 5. COMPLIANCE SCORE
    # --------------------------------

    score = 100

    for finding in findings:

        if finding["severity"] == "violation":
            score -= 30

        elif finding["severity"] == "concern":
            score -= 15

    score = max(0, score)

    # --------------------------------
    # 6. ANALYSIS RESPONSE
    # --------------------------------

    return {
        "status": "analysis_completed",
        "compliance_score": score,
        "total_issues": len(findings),
        "findings": findings,
        "approval_decision": "Not determined"
    }
