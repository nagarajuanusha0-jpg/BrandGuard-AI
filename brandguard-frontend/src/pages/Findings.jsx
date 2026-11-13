
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import {
  apiRequest,
  getSavedUser
} from '../services/api';

import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

function getArray(response, keys) {
  if (Array.isArray(response)) return response;

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data?.[key])) return response.data[key];
  }

  if (Array.isArray(response?.data)) return response.data;

  return [];
}

function getSubmission(response) {
  return (
    response?.submission ||
    response?.data?.submission ||
    response?.data ||
    response
  );
}

function formatDate(value) {
  if (!value) return 'Not available';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Not available'
    : date.toLocaleString();
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// Remove exact duplicate detections while preserving
// different rules and separate occurrences.
function removeDuplicateFindings(items) {
  const seen = new Set();

  return items.filter((item) => {
    const start = item.position?.start ?? null;
    const end = item.position?.end ?? null;

    const excerpt =
      item.submittedEvidence ||
      item.evidenceExcerpt ||
      item.excerpt ||
      item.originalExcerpt ||
      '';

    const key = JSON.stringify({
      ruleId: normalizeText(item.ruleId),
      issue: normalizeText(item.issue),
      severity: normalizeText(item.severity),
      category: normalizeText(item.category),
      start,
      end,
      excerpt: normalizeText(excerpt)
    });

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

export default function Findings() {
  const location = useLocation();

  const user = getSavedUser();
  const role = user?.role || '';

 const selectedSubmissionId = '';
  const notification = location.state?.notification || '';

  const [findings, setFindings] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // Track manual report selection without needing
  // another useEffect to update state after navigation.
  const [reportSelection, setReportSelection] = useState({
    submissionId: selectedSubmissionId,
    reportId: selectedSubmissionId
  });

  const activeReportId =
    reportSelection.submissionId === selectedSubmissionId
      ? reportSelection.reportId
      : selectedSubmissionId;

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setError('');

      try {
        // Load findings for the selected submission,
        // or all findings from the sidebar.
        const findingsEndpoint = selectedSubmissionId
          ? `/submissions/${selectedSubmissionId}/findings`
          : '/findings';

        const findingsResponse = await apiRequest(findingsEndpoint);

        const loadedFindings = getArray(findingsResponse, [
          'findings'
        ]);

        // Always load submissions so the report has
        // its title, status, score and analysis date.
        const submissionsEndpoint =
          role === 'Creator'
            ? '/submissions/mine'
            : '/submissions';

        let loadedSubmissions = [];

        try {
          const submissionsResponse = await apiRequest(
            submissionsEndpoint
          );

          loadedSubmissions = getArray(submissionsResponse, [
            'submissions',
            'results'
          ]);
        } catch (submissionError) {
          console.error(
            'Could not load submission list:',
            submissionError
          );

          if (!selectedSubmissionId) {
            throw submissionError;
          }
        }

        // If the selected submission is not in the list,
        // try loading it directly.
        if (
          selectedSubmissionId &&
          !loadedSubmissions.some(
            (submission) =>
              String(submission._id) === selectedSubmissionId
          )
        ) {
          try {
            const singleResponse = await apiRequest(
              `/submissions/${selectedSubmissionId}`
            );

            const singleSubmission = getSubmission(singleResponse);

            if (
              singleSubmission?._id &&
              String(singleSubmission._id) === selectedSubmissionId
            ) {
              loadedSubmissions = [
                ...loadedSubmissions,
                singleSubmission
              ];
            }
          } catch (singleError) {
            console.error(
              'Could not load selected submission:',
              singleError
            );
          }
        }

        if (isMounted) {
          setFindings(loadedFindings);
          setSubmissions(loadedSubmissions);
        }
      } catch (err) {
        console.error('Error loading AI reports:', err);

        if (isMounted) {
          setError(err.message || 'Failed to load AI reports.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [selectedSubmissionId, retryCount, role]);

  const handleRetry = () => {
    setError('');
    setRetryCount((count) => count + 1);
  };

  // Remove exact duplicates before grouping findings.
  const uniqueFindings = useMemo(
    () => removeDuplicateFindings(findings),
    [findings]
  );

  // Group findings by their submission ID.
  const findingsBySubmission = useMemo(() => {
    const grouped = {};

    uniqueFindings.forEach((item) => {
      const value = item.submissionId || item.submission?._id;

      const id =
        typeof value === 'object' ? value?._id : value;

      if (!id) return;

      const submissionId = String(id);

      if (!grouped[submissionId]) {
        grouped[submissionId] = [];
      }

      grouped[submissionId].push(item);
    });

    return grouped;
  }, [uniqueFindings]);

  // Build the reports from the loaded submissions.
  const reports = useMemo(() => {
    const completedStatuses = [
      'Analysis Complete',
      'Pending Review',
      'Needs Changes',
      'Approved'
    ];

    return submissions
      .filter((submission) => {
        const isSelected =
          selectedSubmissionId &&
          String(submission._id) === selectedSubmissionId;

        const isCompleted =
          submission.analyzedAt &&
          completedStatuses.includes(submission.status);

        return Boolean(isSelected || isCompleted);
      })
      .map((submission) => {
        const reportFindings =
          findingsBySubmission[String(submission._id)] || [];

        return {
          ...submission,
          reportFindings,
          totalFindings: reportFindings.length
        };
      })
      .sort(
        (a, b) =>
          new Date(b.analyzedAt || 0) -
          new Date(a.analyzedAt || 0)
      );
  }, [
    submissions,
    findingsBySubmission,
    selectedSubmissionId
  ]);

  const totalReports = reports.length;

  const totalFindings = reports.reduce(
    (total, report) => total + report.totalFindings,
    0
  );

  const cleanReports = reports.filter(
    (report) => report.totalFindings === 0
  ).length;

  const filteredReports = reports.filter((report) => {
    const query = search.trim().toLowerCase();

    return (
      !query ||
      String(report.title || '').toLowerCase().includes(query) ||
      String(report._id || '').toLowerCase().includes(query)
    );
  });

  const activeReport = reports.find(
    (report) => String(report._id) === String(activeReportId)
  );

  const handleSelectReport = (reportId) => {
    const id = String(reportId);

    setReportSelection({
      submissionId: selectedSubmissionId,
      reportId: activeReportId === id ? '' : id
    });
  };

  const handlePrintReport = (report) => {
    if (!report) return;

    setReportSelection({
      submissionId: selectedSubmissionId,
      reportId: String(report._id)
    });

    setTimeout(() => {
      window.print();
    }, 300);
  };

  const renderLayout = (content) => (
    <div className="dashboard-layout">
      <Navbar />

      <div className="dashboard-body">
        <Sidebar role={role} />

        <main className="dashboard-content">
          {content}
        </main>
      </div>
    </div>
  );

  if (loading) {
    return renderLayout(
      <div className="findings-page">
        {notification && (
          <div className="submit-success" role="status">
            {notification}
          </div>
        )}

        <h2>AI Findings</h2>
        <p>Loading reports...</p>
      </div>
    );
  }

  if (error) {
    return renderLayout(
      <div className="findings-page">
        {notification && (
          <div className="submit-success" role="status">
            {notification}
          </div>
        )}

        <div className="findings-header">
          <h2>AI Findings</h2>
          <p>Review the latest content analysis reports.</p>
        </div>

        <p className="findings-error">{error}</p>

        <button type="button" onClick={handleRetry}>
          Try Again
        </button>
      </div>
    );
  }

  return renderLayout(
    <div className="findings-page">

      {notification && (
        <div className="submit-success" role="status">
          {notification}
        </div>
      )}

      <div className="findings-header">
        <h2>AI Findings</h2>
        <p>
          View the latest AI analysis reports and compliance results.
        </p>
      </div>

      {/* Report Summary and Report List */}
      {!selectedSubmissionId && (
        <>
          <div className="findings-summary report-summary">
            <div className="summary-card">
              <h3>{totalReports}</h3>
              <p>Total Reports</p>
            </div>

            <div className="summary-card">
              <h3>{totalFindings}</h3>
              <p>Total Findings</p>
            </div>

            <div className="summary-card">
              <h3>{cleanReports}</h3>
              <p>Clean Reports</p>
            </div>
          </div>

          <section className="report-centre-section">
            <div className="report-section-header">
              <div>
                <h3>Analysis Reports</h3>
                <p>
                  Latest completed analysis for each submission.
                </p>
              </div>

              <input
                type="search"
                className="report-search"
                placeholder="Search title or submission ID..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="report-table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Submission ID</th>
                    <th>Submission Title</th>
                    <th>Total Findings</th>
                    <th>Compliance Score</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="report-empty">
                        No completed analysis reports found.
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map((report) => (
                      <tr key={report._id}>
                        <td className="report-id">
                          {String(report._id).slice(-8)}
                        </td>

                        <td>
                          {report.title || 'Untitled submission'}
                        </td>

                        <td>
                          <span className="report-count">
                            {report.totalFindings}
                          </span>
                        </td>

                        <td>
                          {report.complianceScore !== null &&
                          report.complianceScore !== undefined
                            ? `${report.complianceScore}%`
                            : 'Not available'}
                        </td>

                        <td>
                          <div className="report-actions">
                            <button
                              type="button"
                              onClick={() =>
                                handleSelectReport(report._id)
                              }
                            >
                              {String(activeReportId) ===
                              String(report._id)
                                ? 'Hide Findings'
                                : 'View Findings'}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handlePrintReport(report)
                              }
                            >
                              View PDF
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handlePrintReport(report)
                              }
                            >
                              Download PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Detailed Findings */}
      {activeReport && (
        <section className="report-detail-section">
          <h3>Report Findings</h3>

          <p>
            <strong>Submission:</strong>{' '}
            {activeReport.title || 'Untitled submission'}
          </p>

          <p>
            <strong>Submission ID:</strong> {activeReport._id}
          </p>

          <p>
            <strong>Analysis Date:</strong>{' '}
            {formatDate(activeReport.analyzedAt)}
          </p>

          {activeReport.reportFindings.length === 0 ? (
            <p className="report-clean-message">
              No findings were identified in this analysis.
            </p>
          ) : (
            <div className="report-table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Issue</th>
                    <th>Severity</th>
                    <th>Evidence</th>
                    <th>Explanation</th>
                    <th>Suggested Correction</th>
                  </tr>
                </thead>

                <tbody>
                  {activeReport.reportFindings.map((item, index) => (
                    <tr key={item._id || `${item.ruleId}-${index}`}>
                      <td>{item.issue || 'Not specified'}</td>
                      <td>{item.severity || 'Not specified'}</td>
                      <td>
                        {item.evidenceExcerpt ||
                          item.excerpt ||
                          item.originalExcerpt ||
                          'Not available'}
                      </td>
                      <td>
                        {item.explanation || 'Not available'}
                      </td>
                      <td>
                        {item.suggestedCorrection || 'Not available'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Printable Report */}
      {activeReport && (
        <div className="report-print-area">
          <h1>BrandGuard AI</h1>
          <h2>Content Compliance Analysis Report</h2>

          <hr />

          <p>
            <strong>Submission ID:</strong> {activeReport._id}
          </p>

          <p>
            <strong>Submission Title:</strong>{' '}
            {activeReport.title || 'Untitled submission'}
          </p>

          <p>
            <strong>Submission Date:</strong>{' '}
            {formatDate(activeReport.submittedAt)}
          </p>

          <p>
            <strong>Analysis Date:</strong>{' '}
            {formatDate(activeReport.analyzedAt)}
          </p>

          <p>
            <strong>Compliance Score:</strong>{' '}
            {activeReport.complianceScore !== null &&
            activeReport.complianceScore !== undefined
              ? `${activeReport.complianceScore}%`
              : 'Not available'}
          </p>

          <p>
            <strong>Total Findings:</strong>{' '}
            {activeReport.totalFindings}
          </p>

          <h3>Findings Details</h3>

          {activeReport.reportFindings.length === 0 ? (
            <p>No compliance findings were identified.</p>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Severity</th>
                  <th>Evidence</th>
                  <th>Explanation</th>
                  <th>Suggested Correction</th>
                </tr>
              </thead>

              <tbody>
                {activeReport.reportFindings.map((item, index) => (
                  <tr key={item._id || `${item.ruleId}-${index}`}>
                    <td>{item.issue || 'Not specified'}</td>
                    <td>{item.severity || 'Not specified'}</td>
                    <td>
                      {item.evidenceExcerpt ||
                        item.excerpt ||
                        item.originalExcerpt ||
                        'Not available'}
                    </td>
                    <td>
                      {item.explanation || 'Not available'}
                    </td>
                    <td>
                      {item.suggestedCorrection || 'Not available'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3>Analysis Summary</h3>

          <p>
            This report represents the latest completed AI analysis
            available for this submission.
          </p>

          <p>Generated by BrandGuard AI.</p>
        </div>
      )}

    </div>
  );
}
