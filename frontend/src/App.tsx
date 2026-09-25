import { FormEvent, useState } from 'react'
import { createFeatureFile, fetchStoryFromJira, generateTests, verifyJiraConnection } from './api'
import { GenerateRequest, GenerateResponse, TestCase } from './types'

function App() {
  const [formData, setFormData] = useState<GenerateRequest>({
    storyTitle: '',
    acceptanceCriteria: '',
    description: '',
    additionalInfo: ''
  })
  const [jiraConnected, setJiraConnected] = useState(false)
  const [jiraLoading, setJiraLoading] = useState(false)
  const [jiraError, setJiraError] = useState<string | null>(null)
  const [results, setResults] = useState<GenerateResponse | null>(null)
  const [featureFileContent, setFeatureFileContent] = useState<string | null>(null)
  const [featureFileExtension, setFeatureFileExtension] = useState<'txt' | 'doc'>('txt')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isFeatureLoading, setIsFeatureLoading] = useState<boolean>(false)
  const [isFetchStoryLoading, setIsFetchStoryLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedTestCases, setExpandedTestCases] = useState<Set<string>>(new Set())
  const [projectName, setProjectName] = useState<string>('')
  const [jiraStoryTitle, setJiraStoryTitle] = useState<string>('')

  const toggleTestCaseExpansion = (testCaseId: string) => {
    const newExpanded = new Set(expandedTestCases)
    if (newExpanded.has(testCaseId)) {
      newExpanded.delete(testCaseId)
    } else {
      newExpanded.add(testCaseId)
    }
    setExpandedTestCases(newExpanded)
  }

  const handleInputChange = (field: keyof GenerateRequest, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleConnectJira = async () => {
    setJiraLoading(true)
    setJiraError(null)

    try {
      const response = await verifyJiraConnection()
      setJiraConnected(response.connected)
      setJiraError(null)
    } catch (err) {
      setJiraError(err instanceof Error ? err.message : 'Failed to connect to Jira')
      setJiraConnected(false)
    } finally {
      setJiraLoading(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    if (!formData.storyTitle.trim() || !formData.acceptanceCriteria.trim()) {
      setError('Story Title and Acceptance Criteria are required')
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const response = await generateTests(formData)
      setResults(response)
      setFeatureFileContent(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate tests')
    } finally {
      setIsLoading(false)
    }
  }

  const sanitizeFileName = (name: string) => {
    return name.replace(/[^a-z0-9 _-]/gi, '').replace(/\s+/g, '_') || 'feature'
  }

  const handleCreateFeatureFile = async () => {
    if (!results) return

    setIsFeatureLoading(true)
    setError(null)

    try {
      const response = await createFeatureFile({
        storyTitle: formData.storyTitle,
        description: formData.description,
        acceptanceCriteria: formData.acceptanceCriteria,
        additionalInfo: formData.additionalInfo,
        cases: results.cases,
      })
      setFeatureFileContent(response.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create feature file')
    } finally {
      setIsFeatureLoading(false)
    }
  }

  const handleDownloadFeatureFile = () => {
    if (!featureFileContent) return

    const fileName = `${sanitizeFileName(formData.storyTitle)}.${featureFileExtension}`
    const blob = new Blob([featureFileContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleFetchStory = async () => {
    if (!projectName.trim() || !jiraStoryTitle.trim()) {
      setError('Project name and story title are required')
      return
    }

    setIsFetchStoryLoading(true)
    setError(null)

    try {
      const response = await fetchStoryFromJira(projectName.trim(), jiraStoryTitle.trim())
      const story = response.story
      
      setFormData(prev => ({
        ...prev,
        storyTitle: story.storyTitle || prev.storyTitle,
        description: story.description || prev.description,
        acceptanceCriteria: story.acceptanceCriteria || prev.acceptanceCriteria
      }))
      
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch story from Jira')
    } finally {
      setIsFetchStoryLoading(false)
    }
  }

  return (
    <div>
      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          background-color: #ffffff;
          color: #333;
          line-height: 1.6;
        }
        
        .container {
          max-width: 95%;
          width: 100%;
          margin: 0 auto;
          padding: 20px;
          min-height: 100vh;
        }
        
        @media (min-width: 768px) {
          .container {
            max-width: 90%;
            padding: 30px;
          }
        }
        
        @media (min-width: 1024px) {
          .container {
            max-width: 85%;
            padding: 40px;
          }
        }
        
        @media (min-width: 1440px) {
          .container {
            max-width: 1800px;
            padding: 50px;
          }
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        
        .title {
          font-size: 2.5rem;
          color: #2c3e50;
          margin-bottom: 10px;
        }
        
        .subtitle {
          color: #666;
          font-size: 1.1rem;
        }

        .jira-section {
          background: #f0f7ff;
          border: 2px solid #d0e8ff;
          border-radius: 8px;
          padding: 30px;
          margin-bottom: 40px;
        }

        .jira-section-title {
          font-size: 1.4rem;
          color: #2c3e50;
          margin-bottom: 8px;
          font-weight: 600;
        }

        .jira-section-subtitle {
          color: #666;
          font-size: 0.95rem;
          margin-bottom: 20px;
        }

        .fetch-story-form {
          background: white;
          border-radius: 6px;
          padding: 20px;
          margin-top: 20px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        @media (min-width: 768px) {
          .form-row {
            grid-template-columns: 1fr 1fr;
          }
        }

        .story-creation-section {
          background: white;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          margin-bottom: 30px;
        }

        .section-title {
          font-size: 1.4rem;
          color: #2c3e50;
          margin-bottom: 8px;
          font-weight: 600;
        }

        .section-subtitle {
          color: #666;
          font-size: 0.95rem;
          margin-bottom: 24px;
        }
        
        .form-container {
          width: 100%;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-label {
          display: block;
          font-weight: 600;
          margin-bottom: 8px;
          color: #2c3e50;
        }
        
        .form-input, .form-textarea {
          width: 100%;
          padding: 12px;
          border: 2px solid #e1e8ed;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.2s;
        }
        
        .form-input:focus, .form-textarea:focus {
          outline: none;
          border-color: #3498db;
        }
        
        .form-textarea {
          resize: vertical;
          min-height: 100px;
        }
        
        .submit-btn {
          background: #3498db;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .submit-btn:hover:not(:disabled) {
          background: #2980b9;
        }
        
        .submit-btn:disabled {
          background: #bdc3c7;
          cursor: not-allowed;
        }
        
        .error-banner {
          background: #e74c3c;
          color: white;
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 20px;
        }
        
        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
          font-size: 18px;
        }
        
        .results-container {
          background: white;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .results-header {
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid #e1e8ed;
        }
        
        .results-title {
          font-size: 1.8rem;
          color: #2c3e50;
          margin-bottom: 10px;
        }
        
        .results-meta {
          color: #666;
          font-size: 14px;
        }
        
        .connect-btn {
          background: #2d8cff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
          margin-top: 16px;
        }

        .connect-btn:hover {
          background: #2277e1;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          width: min(100%, 520px);
          background: white;
          border-radius: 14px;
          padding: 24px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.15);
          position: relative;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }

        .modal-title {
          font-size: 1.25rem;
          color: #2c3e50;
        }

        .modal-close {
          background: transparent;
          border: none;
          color: #666;
          font-size: 1.3rem;
          cursor: pointer;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 18px;
        }

        .secondary-btn {
          background: #f1f1f1;
          color: #333;
        }

        .secondary-btn:hover {
          background: #e2e2e2;
        }

        .submit-btn {
          background: #3498db;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .submit-btn:hover:not(:disabled) {
          background: #2980b9;
        }

        .submit-btn:disabled {
          background: #bdc3c7;
          cursor: not-allowed;
        }

        .error-banner {
          background: #e74c3c;
          color: white;
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 20px;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
          font-size: 18px;
        }

        .results-container {
          background: white;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          margin-bottom: 30px;
        }

        .results-header {
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid #e1e8ed;
        }

        .results-title {
          font-size: 1.8rem;
          color: #2c3e50;
          margin-bottom: 10px;
        }

        .results-meta {
          color: #666;
          font-size: 14px;
        }

        .table-container {
          overflow-x: auto;
          text-align: left;
          border-bottom: 1px solid #e1e8ed;
        }
        
        .results-table th {
          background: #f8f9fa;
          font-weight: 600;
          color: #2c3e50;
        }
        
        .results-table tr:hover {
          background: #f8f9fa;
        }
        
        .category-positive { color: #27ae60; font-weight: 600; }
        .category-negative { color: #e74c3c; font-weight: 600; }
        .category-edge { color: #f39c12; font-weight: 600; }
        .category-authorization { color: #9b59b6; font-weight: 600; }
        .category-non-functional { color: #34495e; font-weight: 600; }
        
        .test-case-id {
          cursor: pointer;
          color: #3498db;
          font-weight: 600;
          padding: 8px 12px;
          border-radius: 4px;
          transition: background-color 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        
        .test-case-id:hover {
          background: #f8f9fa;
        }
        
        .test-case-id.expanded {
          background: #e3f2fd;
          color: #1976d2;
        }
        
        .expand-icon {
          font-size: 10px;
          transition: transform 0.2s;
        }
        
        .expand-icon.expanded {
          transform: rotate(90deg);
        }
        
        .expanded-details {
          margin-top: 15px;
          background: #fafbfc;
          border: 1px solid #e1e8ed;
          border-radius: 8px;
          padding: 20px;
        }
        
        .step-item {
          background: white;
          border: 1px solid #e1e8ed;
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        
        .step-header {
          display: grid;
          grid-template-columns: 80px 1fr 1fr 1fr;
          gap: 15px;
          align-items: start;
        }
        
        .step-id {
          font-weight: 600;
          color: #2c3e50;
          background: #f8f9fa;
          padding: 4px 8px;
          border-radius: 4px;
          text-align: center;
          font-size: 12px;
        }
        
        .step-description {
          color: #2c3e50;
          line-height: 1.5;
        }
        
        .step-test-data {
          color: #666;
          font-style: italic;
          font-size: 14px;
        }
        
        .step-expected {
          color: #27ae60;
          font-weight: 500;
          font-size: 14px;
        }
        
        .step-labels {
          display: grid;
          grid-template-columns: 80px 1fr 1fr 1fr;
          gap: 15px;
          margin-bottom: 10px;
          font-weight: 600;
          color: #666;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .actions-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: flex-end;
        }

        .success-btn {
          background: #2ecc71;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .success-btn:hover:not(:disabled) {
          background: #27ae60;
        }

        .success-btn:disabled {
          background: #bdc3c7;
          cursor: not-allowed;
        }

        .feature-options {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 140px;
        }

        .feature-extension-select {
          background: #2ecc71;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .feature-file-block {
          background: #f8f9fa;
          border: 1px solid #e1e8ed;
          border-radius: 8px;
          padding: 20px;
          white-space: pre-wrap;
          word-break: break-word;
          margin-top: 20px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
          max-height: 450px;
          overflow: auto;
        }

        .feature-options {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 12px;
        }

        .feature-options label {
          font-size: 14px;
          color: #333;
          font-weight: 600;
        }

        .feature-extension-select {
          padding: 10px 12px;
          border-radius: 6px;
          border: 2px solid #e1e8ed;
          background: white;
          font-size: 14px;
          color: #333;
        }
      `}</style>
      
      <div className="container">
        <div className="header">
          <h1 className="title">User Story to Tests</h1>
          <p className="subtitle">Generate comprehensive test cases from your user stories</p>
        </div>

        <div className="jira-section">
          <div className="jira-section-title">Fetch Story from Jira</div>
          <p className="jira-section-subtitle">Connect to Jira using credentials from .env file and fetch stories by project name</p>
          
          <button 
            type="button" 
            className="connect-btn" 
            onClick={handleConnectJira}
            disabled={jiraLoading}
          >
            {jiraLoading ? 'Connecting...' : (jiraConnected ? '✓ Jira Connected' : 'Connect Jira')}
          </button>

          {jiraError && (
            <div className="error-banner" style={{ marginTop: '12px' }}>
              {jiraError}
            </div>
          )}

          {jiraConnected && (
            <div className="fetch-story-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="projectName" className="form-label">Project Name *</label>
                  <input
                    type="text"
                    id="projectName"
                    className="form-input"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g., My Project"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="jiraStoryTitleInput" className="form-label">Story Title / Summary *</label>
                  <input
                    type="text"
                    id="jiraStoryTitleInput"
                    className="form-input"
                    value={jiraStoryTitle}
                    onChange={(e) => setJiraStoryTitle(e.target.value)}
                    placeholder="e.g., Implement user login"
                  />
                </div>
              </div>

              <button
                type="button"
                className="success-btn"
                onClick={handleFetchStory}
                disabled={isFetchStoryLoading || !projectName.trim() || !jiraStoryTitle.trim()}
              >
                {isFetchStoryLoading ? 'Fetching...' : 'Fetch Story'}
              </button>
            </div>
          )}
        </div>

        <div className="story-creation-section">
          <div className="section-title">Create Test Cases</div>
          <p className="section-subtitle">Enter your story details to generate test cases</p>

          <form onSubmit={handleSubmit} className="form-container">
            <div className="form-group">
              <label htmlFor="storyTitle" className="form-label">
                Story Title *
              </label>
              <input
                type="text"
                id="storyTitle"
                className="form-input"
                value={formData.storyTitle}
                onChange={(e) => handleInputChange('storyTitle', e.target.value)}
                placeholder="Enter the user story title..."
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">
                Description
              </label>
              <textarea
                id="description"
                className="form-textarea"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Additional description (optional)..."
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="acceptanceCriteria" className="form-label">
                Acceptance Criteria *
              </label>
              <textarea
                id="acceptanceCriteria"
                className="form-textarea"
                value={formData.acceptanceCriteria}
                onChange={(e) => handleInputChange('acceptanceCriteria', e.target.value)}
                placeholder="Enter the acceptance criteria..."
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="additionalInfo" className="form-label">
                Additional Info
              </label>
              <textarea
                id="additionalInfo"
                className="form-textarea"
                value={formData.additionalInfo}
                onChange={(e) => handleInputChange('additionalInfo', e.target.value)}
                placeholder="Any additional information (optional)..."
              />
            </div>
          
            <div className="actions-row">
              <button
                type="submit"
                className="submit-btn"
                disabled={isLoading}
              >
                {isLoading ? 'Generating...' : 'Generate Test Cases'}
              </button>
              <button
                type="button"
                className="success-btn"
                onClick={handleCreateFeatureFile}
                disabled={!results || isFeatureLoading}
              >
                {isFeatureLoading ? 'Creating...' : 'Create Feature File'}
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="loading">
            Generating test cases...
          </div>
        )}

        {results && (
          <div className="results-container">
            <div className="results-header">
              <h2 className="results-title">Generated Test Cases</h2>
              <div className="results-meta">
                {results.cases.length} test case(s) generated
                {results.model && ` • Model: ${results.model}`}
                {results.promptTokens > 0 && ` • Tokens: ${results.promptTokens + results.completionTokens}`}
              </div>
            </div>
            
            <div className="table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Test Case ID</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Expected Result</th>
                  </tr>
                </thead>
                <tbody>
                  {results.cases.map((testCase: TestCase) => (
                    <>
                      <tr key={testCase.id}>
                        <td>
                          <div 
                            className={`test-case-id ${expandedTestCases.has(testCase.id) ? 'expanded' : ''}`}
                            onClick={() => toggleTestCaseExpansion(testCase.id)}
                          >
                            <span className={`expand-icon ${expandedTestCases.has(testCase.id) ? 'expanded' : ''}`}>
                              ▶
                            </span>
                            {testCase.id}
                          </div>
                        </td>
                        <td>{testCase.title}</td>
                        <td>
                          <span className={`category-${testCase.category.toLowerCase()}`}>
                            {testCase.category}
                          </span>
                        </td>
                        <td>{testCase.expectedResult}</td>
                      </tr>
                      {expandedTestCases.has(testCase.id) && (
                        <tr key={`${testCase.id}-details`}>
                          <td colSpan={4}>
                            <div className="expanded-details">
                              <h4 style={{marginBottom: '15px', color: '#2c3e50'}}>Test Steps for {testCase.id}</h4>
                              <div className="step-labels">
                                <div>Step ID</div>
                                <div>Step Description</div>
                                <div>Test Data</div>
                                <div>Expected Result</div>
                              </div>
                              {testCase.steps.map((step, index) => (
                                <div key={index} className="step-item">
                                  <div className="step-header">
                                    <div className="step-id">S{String(index + 1).padStart(2, '0')}</div>
                                    <div className="step-description">{step}</div>
                                    <div className="step-test-data">{testCase.testData || 'N/A'}</div>
                                    <div className="step-expected">
                                      {index === testCase.steps.length - 1 ? testCase.expectedResult : 'Step completed successfully'}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
            {featureFileContent && (
              <div style={{ marginTop: '24px' }}>
                <div className="results-header">
                  <h2 className="results-title">Feature File Preview</h2>
                  <div className="results-meta">
                    Download as <strong>.{featureFileExtension}</strong>
                  </div>
                </div>
                <div className="actions-row" style={{ justifyContent: 'space-between' }}>
                  <button type="button" className="success-btn" onClick={handleDownloadFeatureFile}>
                    Download Feature File
                  </button>
                  <div className="feature-options">
                    <label htmlFor="featureExtension">Download as</label>
                    <select
                      id="featureExtension"
                      className="feature-extension-select"
                      value={featureFileExtension}
                      onChange={(e) => setFeatureFileExtension(e.target.value as 'txt' | 'doc')}
                    >
                      <option value="txt">.txt</option>
                      <option value="doc">.docx</option>
                    </select>
                  </div>
                </div>
                <div className="feature-file-block">{featureFileContent}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App