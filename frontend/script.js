class TruthLensGemini {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        
        // Backend API configuration - Updated for local network
        this.backendUrl = this.getBackendUrl();
        this.apiEndpoint = `${this.backendUrl}/api/fact-check`;
        
        // Rate limiting tracking
        this.requestCount = 0;
        this.maxRequestsPerHour = 100;
        
        this.initializeImageUpload();
    }

    getBackendUrl() {
        // Check if we're running on ngrok
        const currentHost = window.location.hostname;
        
        if (currentHost.includes('ngrok-free.app') || currentHost.includes('ngrok.app')) {
            // Running on ngrok - use the ngrok backend URL
            // REPLACE THIS with your actual ngrok backend URL
            return 'https://e229746edd80.ngrok-free.app'; // Replace with your backend ngrok URL
        } else if (currentHost === '172.16.32.11') {
            // Running on network IP, use network backend
            return 'http://172.16.32.11:5000';
        } else if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
            // Running on localhost
            return 'http://localhost:5000';
        } else {
            // Fallback - try to use the same host as frontend
            return `https://${currentHost.replace('-frontend', '-backend')}`;
        }
    }

    initializeElements() {
        this.newsInput = document.getElementById('newsInput');
        this.checkBtn = document.getElementById('checkBtn');
        this.imageUploadBtn = document.getElementById('imageUploadBtn');
        this.imageInput = document.getElementById('imageInput');
        this.imagePreview = document.getElementById('imagePreview');
        this.uploadedImage = document.getElementById('uploadedImage');
        this.removeImageBtn = document.getElementById('removeImageBtn');
        this.resultsSection = document.getElementById('resultsSection');
        this.credibilityScore = document.getElementById('credibilityScore');
        this.scoreValue = document.getElementById('scoreValue');
        this.verdict = document.getElementById('verdict');
        this.geminiAnalysis = document.getElementById('geminiAnalysis');
        this.verificationStatus = document.getElementById('verificationStatus');
        this.riskAssessment = document.getElementById('riskAssessment');
        this.recommendations = document.getElementById('recommendations');
        this.newCheckBtn = document.getElementById('newCheckBtn');
        this.reanalyzeBtn = document.getElementById('reanalyzeBtn');
        this.totalChecks = document.getElementById('totalChecks');
    }

    initializeImageUpload() {
        // Create image upload elements if they don't exist
        if (!this.imageUploadBtn) {
            this.createImageUploadElements();
        }
        
        this.currentImage = null;
        this.currentImageFile = null;
    }

    createImageUploadElements() {
        // Find the input group and add image upload elements
        const inputGroup = document.querySelector('.input-group');
        
        // Create image upload section
        const imageSection = document.createElement('div');
        imageSection.className = 'image-upload-section';
        imageSection.innerHTML = `
            <div class="upload-controls">
                <input type="file" id="imageInput" accept="image/*" style="display: none;">
                <button type="button" id="imageUploadBtn" class="image-upload-btn">
                    <i class="fas fa-image"></i>
                    Upload Image to Analyze
                </button>
                <div class="upload-info">
                    <small><i class="fas fa-info-circle"></i> Supports: JPG, PNG, GIF, WEBP • Max 10MB • AI-powered authenticity detection</small>
                </div>
                <div class="upload-features">
                    <div class="feature-tag"><i class="fas fa-shield-alt"></i> Deepfake Detection</div>
                    <div class="feature-tag"><i class="fas fa-robot"></i> AI-Generated Detection</div>
                    <div class="feature-tag"><i class="fas fa-search"></i> Reverse Image Search</div>
                    <div class="feature-tag"><i class="fas fa-magic"></i> Manipulation Analysis</div>
                </div>
            </div>
            
            <!-- Image Preview Area -->
            <div id="imagePreview" class="image-preview" style="display: none;">
                <div class="preview-header">
                    <h4><i class="fas fa-image"></i> Image Ready for Analysis</h4>
                </div>
                <div class="preview-container">
                    <img id="uploadedImage" alt="Uploaded image">
                    <button type="button" id="removeImageBtn" class="remove-image-btn" title="Remove image">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="image-overlay">
                        <div class="overlay-info">
                            <i class="fas fa-eye"></i>
                            <span>Vision AI Ready</span>
                        </div>
                    </div>
                </div>
                <div class="image-info">
                    <div class="info-item">
                        <i class="fas fa-file"></i>
                        <span id="imageFileName">filename.jpg</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-weight-hanging"></i>
                        <span id="imageSize">1.2 MB</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-check-circle"></i>
                        <span>Ready</span>
                    </div>
                </div>
            </div>
            
            <!-- Drag and Drop Overlay -->
            <div class="drag-drop-overlay">
                <div class="drag-content">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <h3>Drop Image Here</h3>
                    <p>or click to select from your device</p>
                </div>
            </div>
        `;
        
        // Insert after textarea, before button
        const textarea = inputGroup.querySelector('textarea');
        textarea.insertAdjacentElement('afterend', imageSection);
        
        // Re-initialize elements
        this.imageUploadBtn = document.getElementById('imageUploadBtn');
        this.imageInput = document.getElementById('imageInput');
        this.imagePreview = document.getElementById('imagePreview');
        this.uploadedImage = document.getElementById('uploadedImage');
        this.removeImageBtn = document.getElementById('removeImageBtn');
    }

    bindEvents() {
        this.checkBtn.addEventListener('click', () => this.analyzeWithBackend());
        this.newCheckBtn.addEventListener('click', () => this.resetForm());
        this.reanalyzeBtn.addEventListener('click', () => this.analyzeWithBackend());

        // Image upload events
        if (this.imageUploadBtn) {
            this.imageUploadBtn.addEventListener('click', () => this.imageInput.click());
        }
        if (this.imageInput) {
            this.imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        }
        if (this.removeImageBtn) {
            this.removeImageBtn.addEventListener('click', () => this.removeImage());
        }

        // Example buttons
        document.querySelectorAll('.example-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.newsInput.value = e.target.dataset.text;
            });
        });

        // Enter key support
        this.newsInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.analyzeWithBackend();
            }
        });

        // Drag and drop support
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        const inputCard = document.querySelector('.input-card');
        
        if (inputCard) {
            inputCard.addEventListener('dragover', (e) => {
                e.preventDefault();
                inputCard.classList.add('drag-over');
            });
            
            inputCard.addEventListener('dragleave', () => {
                inputCard.classList.remove('drag-over');
            });
            
            inputCard.addEventListener('drop', (e) => {
                e.preventDefault();
                inputCard.classList.remove('drag-over');
                
                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type.startsWith('image/')) {
                    this.processImageFile(files[0]);
                }
            });
        }
    }

    async handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file
        if (!file.type.startsWith('image/')) {
            this.showError('Please select a valid image file.');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            this.showError('Image file must be less than 10MB.');
            return;
        }
        
        await this.processImageFile(file);
    }

    async processImageFile(file) {
        try {
            // Show loading state
            this.imageUploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing Image...';
            this.imageUploadBtn.disabled = true;
            
            // Store the actual file for backend upload
            this.currentImageFile = file;
            
            // Create preview URL
            const previewUrl = URL.createObjectURL(file);
            
            // Show preview
            this.uploadedImage.src = previewUrl;
            this.imagePreview.style.display = 'block';
            
            // Update file info
            document.getElementById('imageFileName').textContent = file.name;
            document.getElementById('imageSize').textContent = this.formatFileSize(file.size);
            
            // Update button
            this.imageUploadBtn.innerHTML = '<i class="fas fa-check"></i> Image Ready for Analysis';
            this.imageUploadBtn.classList.add('image-loaded');
            
        } catch (error) {
            console.error('Error processing image:', error);
            this.showError('Failed to process image. Please try again.');
        } finally {
            this.imageUploadBtn.disabled = false;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    removeImage() {
        // Clean up object URL to prevent memory leaks
        if (this.uploadedImage.src.startsWith('blob:')) {
            URL.revokeObjectURL(this.uploadedImage.src);
        }
        
        this.currentImageFile = null;
        this.imagePreview.style.display = 'none';
        this.imageInput.value = '';
        this.imageUploadBtn.innerHTML = '<i class="fas fa-image"></i> Upload Image to Analyze';
        this.imageUploadBtn.classList.remove('image-loaded');
    }

async analyzeWithBackend() {
    const content = this.newsInput.value.trim();
    const hasImage = this.currentImageFile !== null;
    
    if (!content && !hasImage) {
        this.showError('Please enter some text or upload an image to analyze.');
        return;
    }

    let response;
    
    try {
        // Check rate limits
        if (this.requestCount >= this.maxRequestsPerHour) {
            this.showError('Hourly request limit reached. Please try again later.');
            return;
        }

        // Disable button and show loading
        this.checkBtn.disabled = true;
        if (hasImage) {
            this.checkBtn.innerHTML = '<i class="fas fa-cog fa-spin"></i> AI Vision + Search Analysis...';
        } else {
            this.checkBtn.innerHTML = '<i class="fas fa-cog fa-spin"></i> Gemini + Google Search Processing...';
        }
        
        // Show results section
        this.resultsSection.style.display = 'block';
        this.resultsSection.scrollIntoView({ behavior: 'smooth' });

        // Prepare form data for backend
        const formData = new FormData();
        
        if (content) {
            formData.append('content', content);
        }
        
        if (hasImage && this.currentImageFile) {
            formData.append('image', this.currentImageFile);
        }

        console.log('Making request to backend...', {
            url: `${this.apiEndpoint}/analyze`,
            hasContent: !!content,
            hasImage: hasImage
        });

        // Make API request to backend with proper error handling
        response = await fetch(`${this.apiEndpoint}/analyze`, {
            method: 'POST',
            body: formData,
            // Remove any headers - let browser handle FormData headers
        });

        console.log('Response received:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
        });

        // Check if response is ok
        if (!response.ok) {
            let errorData;
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                try {
                    errorData = await response.json();
                } catch (e) {
                    console.error('Failed to parse error JSON:', e);
                    errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
                }
            } else {
                const textResponse = await response.text();
                console.error('Non-JSON error response:', textResponse);
                errorData = { message: textResponse || `HTTP ${response.status}: ${response.statusText}` };
            }
            
            if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please wait before trying again.');
            } else if (response.status === 413) {
                throw new Error('File too large. Please use an image smaller than 10MB.');
            } else if (response.status === 400) {
                throw new Error(errorData.message || 'Invalid request. Please check your input.');
            } else if (response.status === 500) {
                throw new Error(errorData.message || 'Server error. Please try again.');
            } else {
                throw new Error(errorData.message || `Server error: ${response.status}`);
            }
        }

        // Parse successful response
        let data;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            try {
                data = await response.json();
                console.log('Parsed JSON response:', data);
            } catch (e) {
                console.error('Failed to parse success JSON:', e);
                const textResponse = await response.text();
                console.error('Raw response:', textResponse);
                throw new Error('Invalid JSON response from server');
            }
        } else {
            const textResponse = await response.text();
            console.error('Non-JSON success response:', textResponse);
            throw new Error('Server returned non-JSON response');
        }
        
        if (!data || !data.success) {
            console.error('Backend returned unsuccessful response:', data);
            throw new Error(data?.message || 'Analysis failed - server returned unsuccessful response');
        }

        if (!data.data || !data.data.analysis) {
            console.error('Missing analysis data in response:', data);
            throw new Error('Invalid response format from server');
        }

        console.log('Analysis successful:', {
            credibilityScore: data.data.analysis.credibilityScore,
            verdict: data.data.analysis.verdict,
            processingTime: data.data.metadata?.processingTime
        });

        // Display results using the analysis data from backend
        await this.displayBackendResults(data.data.analysis, data.data.metadata);
        
        // Update request count
        this.requestCount++;
        
    } catch (error) {
        console.error('Full error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            response: response ? {
                status: response.status,
                statusText: response.statusText,
                url: response.url
            } : 'No response object'
        });
        
        // Enhanced error handling
        if (error.name === 'TypeError') {
            if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
                this.showError('Cannot connect to backend server. Please ensure the backend is running on http://localhost:5000 and CORS is properly configured.');
            } else if (error.message.includes('JSON')) {
                this.showError('Server response format error. Please check backend logs.');
            } else {
                this.showError(`Network error: ${error.message}`);
            }
        } else if (error.name === 'SyntaxError') {
            this.showError('Server returned invalid response format. Please check backend logs.');
        } else {
            this.showError(`Analysis failed: ${error.message}`);
        }
    } finally {
        this.checkBtn.disabled = false;
        this.checkBtn.innerHTML = '<i class="fas fa-robot"></i> Analyze with Gemini + Search';
        this.updateStats();
    }
}


    async displayBackendResults(results, metadata) {
        // Progressive display of backend analysis results
        
        // Stage 1: Update credibility score
        await this.delay(400);
        this.updateCredibilityScore(results.credibilityScore);
        
        // Stage 2: Show verdict with backend info
        await this.delay(300);
        this.updateBackendVerdict(results.verdict, results.credibilityScore, results.groundingMetadata, metadata);
        
        // Stage 3: Display backend analysis
        await this.delay(500);
        this.displayBackendAnalysis(results, metadata);
        
        // Stage 4: Show search findings
        await this.delay(400);
        this.displaySearchFindings(results.searchFindings, results.groundingMetadata, results.hasImage, results.reverseImageSearch);
        
        // Stage 5: Display risk assessment
        await this.delay(300);
        this.displayBackendRiskAssessment(results.misinformationAnalysis, metadata);
        
        // Stage 6: Show recommendations
        await this.delay(200);
        this.displayBackendRecommendations(results.sourceRecommendations, results.groundingMetadata, metadata);
    }

    updateCredibilityScore(score) {
        let currentScore = 0;
        const targetScore = score;
        const increment = Math.ceil(targetScore / 30);
        
        const animateScore = () => {
            if (currentScore < targetScore) {
                currentScore = Math.min(currentScore + increment, targetScore);
                this.scoreValue.textContent = currentScore;
                
                const scoreDeg = (currentScore / 100) * 360;
                const scoreCircle = document.querySelector('.score-circle');
                if (scoreCircle) {
                    scoreCircle.style.setProperty('--score-deg', `${scoreDeg}deg`);
                    
                    let color = '#ef4444'; // Red
                    if (currentScore >= 85) color = '#22c55e'; // Green for verified facts
                    else if (currentScore >= 70) color = '#34d399'; // Light green
                    else if (currentScore >= 60) color = '#f59e0b'; // Yellow
                    else if (currentScore >= 40) color = '#fb923c'; // Orange
                    
                    scoreCircle.style.background = `conic-gradient(${color} 0deg, ${color} ${scoreDeg}deg, #e5e7eb ${scoreDeg}deg, #e5e7eb 360deg)`;
                }
                
                requestAnimationFrame(animateScore);
            }
        };
        
        animateScore();
    }

    updateBackendVerdict(verdict, score, groundingMetadata, metadata) {
        const verdictElement = this.verdict;
        verdictElement.className = `verdict ${verdict}`;
        
        let icon, text, description;
        const isGrounded = groundingMetadata && (groundingMetadata.searchQueries?.length > 0 || groundingMetadata.webResults?.length > 0);
        const hasImage = metadata?.hasImage || false;
        
        switch (verdict) {
            case 'true':
                icon = 'fas fa-check-circle';
                if (score >= 85) {
                    text = hasImage ? `Authentic Content` : `Verified Fact`;
                    description = `${score}% credible • ${hasImage ? 'Image and text verified' : 'Search confirmed'} by authoritative sources`;
                } else {
                    text = `Likely Credible`;
                    description = `${score}% credible • ${isGrounded ? 'Search supported' : 'AI analysis'}`;
                }
                break;
            case 'false':
                icon = 'fas fa-times-circle';
                text = hasImage ? `Fake/Manipulated Content` : `False Information`;
                description = `${100-score}% suspicious • ${hasImage ? 'AI generation or manipulation detected' : 'Contradicted by search results'}`;
                break;
            default:
                icon = 'fas fa-question-circle';
                if (score >= 70) {
                    text = `Likely Accurate - Verify Sources`;
                    description = `${score}% credible • ${hasImage ? 'Image authenticity uncertain' : 'Mixed search signals'}`;
                } else {
                    text = `Requires Verification`;
                    description = `${score}% credible • ${hasImage ? 'Suspicious elements detected' : 'Inconclusive evidence'}`;
                }
        }
        
        if (isGrounded) {
            description += ' • 🔍 Google Search Enhanced';
        }
        if (hasImage) {
            description += ' • 👁️ Vision AI';
        }
        description += ` • ⚡ Backend Processed (${metadata?.processingTime || 'N/A'}ms)`;
        
        verdictElement.innerHTML = `
            <i class="${icon}"></i>
            <div>
                <div style="font-size: 1.2rem; margin-bottom: 3px;">${text}</div>
                <div style="font-size: 0.85rem; opacity: 0.8; font-weight: normal;">${description}</div>
            </div>
        `;
    }

    displayBackendAnalysis(results, metadata) {
        let html = `<div class="gemini-response gemini-grounded ${results.hasImage ? 'multimodal-analysis' : ''}">`;
        
        html += `<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
            <i class="fas fa-${results.hasImage ? 'eye' : 'search'}" style="color: #4285f4; font-size: 1.2rem;"></i>
            <h5 style="margin: 0; color: #4285f4;">${results.hasImage ? 'Gemini Vision + Google Search Analysis' : 'Gemini + Google Search Analysis'}</h5>
            <span class="gemini-score" style="font-size: 0.8rem;">${results.hasImage ? 'Multimodal Backend' : 'Backend API'}</span>
        </div>`;
        
        // Backend processing info
        html += `<div class="backend-info" style="background: rgba(34, 197, 94, 0.1); padding: 10px; border-radius: 8px; margin-bottom: 15px;">
            <div style="display: flex; gap: 15px; font-size: 0.85rem; flex-wrap: wrap;">
                <span><strong>Processing Time:</strong> ${metadata?.processingTime || 'N/A'}ms</span>
                <span><strong>Model:</strong> ${results.model || 'gemini-2.5-flash'}</span>
                <span><strong>Request ID:</strong> ${metadata?.requestId || 'N/A'}</span>
                <span><strong>Backend:</strong> ✅ Secure API</span>
            </div>
        </div>`;
        
        // Image analysis section (if applicable)
        if (results.hasImage && results.imageAnalysis) {
            html += `<div class="analysis-section image-analysis-section">
                <h6 style="color: #9c27b0; margin-bottom: 8px;"><i class="fas fa-camera"></i> Image Authenticity Analysis</h6>
                <div>${this.formatGeminiText(results.imageAnalysis)}</div>
            </div>`;
        }
        
        // Fake detection section (if applicable)
        if (results.hasImage && results.fakeDetection) {
            html += `<div class="analysis-section fake-detection-section">
                <h6 style="color: #e91e63; margin-bottom: 8px;"><i class="fas fa-shield-alt"></i> AI/Manipulation Detection</h6>
                <div>${this.formatGeminiText(results.fakeDetection)}</div>
            </div>`;
        }
        
        // Search verification details
        if (results.searchVerificationDetails) {
            html += `<div class="analysis-section">
                <h6 style="color: #0d7377; margin-bottom: 8px;"><i class="fas fa-search-plus"></i> Search Verification Details</h6>
                <div>${this.formatGeminiText(results.searchVerificationDetails)}</div>
            </div>`;
        }
        
        // Fact verification section
        if (results.factVerification) {
            html += `<div class="analysis-section">
                <h6 style="color: #34a853; margin-bottom: 8px;"><i class="fas fa-check-double"></i> Live Fact Verification</h6>
                <div>${this.formatGeminiText(results.factVerification)}</div>
            </div>`;
        }
        
        // Context explanation
        if (results.contextExplanation) {
            html += `<div class="analysis-section">
                <h6 style="color: #ea4335; margin-bottom: 8px;"><i class="fas fa-info-circle"></i> Search-Enhanced Analysis</h6>
                <div>${this.formatGeminiText(results.contextExplanation)}</div>
            </div>`;
        }
        
        // Grounding indicators
        if (results.groundingMetadata) {
            const { searchQueries, webResults } = results.groundingMetadata;
            const verificationLevel = webResults?.length >= 5 ? 'High' : webResults?.length >= 3 ? 'Medium' : 'Basic';
            
            html += `<div style="margin-top: 15px; padding: 10px; background: rgba(66, 133, 244, 0.1); border-radius: 8px;">
                <div style="display: flex; gap: 15px; font-size: 0.85rem; flex-wrap: wrap;">
                    <span><strong>Google Searches:</strong> ${searchQueries?.length || 0}</span>
                    <span><strong>Web Sources:</strong> ${webResults?.length || 0}</span>
                    <span><strong>Verification:</strong> ${verificationLevel}</span>
                    ${results.hasImage ? '<span><strong>Vision AI:</strong> ✅ Multimodal</span>' : ''}
                    <span><strong>Backend:</strong> ✅ Secure Processing</span>
                </div>
            </div>`;
        }
        
        html += `</div>`;
        this.geminiAnalysis.innerHTML = html;
    }

    displaySearchFindings(findings, groundingMetadata, hasImage = false, reverseImageSearch = null) {
        let html = `<div class="search-findings-section ${hasImage ? 'multimodal-findings' : ''}">`;
        
        html += `<h5 style="color: #34a853; margin-bottom: 15px;">
            <i class="fas fa-globe"></i> ${hasImage ? 'Multimodal Search Findings' : 'Google Search Findings'}
        </h5>`;
        
        // Reverse image search results (if applicable)
        if (hasImage && reverseImageSearch) {
            html += `<div class="reverse-image-search" style="margin-bottom: 20px;">
                <h6 style="color: #9c27b0; margin-bottom: 10px;">
                    <i class="fas fa-images"></i> Reverse Image Search Results:
                </h6>
                <div class="search-content image-search-content">
                    ${this.formatGeminiText(reverseImageSearch)}
                </div>
            </div>`;
        }
        
        // Text/general search findings
        if (findings) {
            html += `<div class="search-content">
                ${this.formatGeminiText(findings)}
            </div>`;
        }
        
        // Search queries used
        if (groundingMetadata?.searchQueries?.length > 0) {
            html += `<div class="search-queries" style="margin-top: 15px;">
                <h6 style="color: #666; margin-bottom: 10px;">
                    <i class="fas fa-search"></i> Search Queries Used:
                </h6>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">`;
            
            groundingMetadata.searchQueries.forEach(query => {
                html += `<span class="search-query">${query}</span>`;
            });
            
            html += `</div></div>`;
        }
        
        // Web sources found
        if (groundingMetadata?.webResults?.length > 0) {
            html += `<div class="web-sources" style="margin-top: 15px;">
                <h6 style="color: #666; margin-bottom: 10px;">
                    <i class="fas fa-link"></i> Sources Found:
                </h6>`;
            
            groundingMetadata.webResults.slice(0, 5).forEach(result => {
                html += `<div class="web-source">
                    <a href="${result.url}" target="_blank" style="color: #1a73e8; text-decoration: none;">
                        <strong>${result.title}</strong>
                    </a>
                    <p style="margin: 5px 0; color: #666; font-size: 0.9rem;">${result.snippet}</p>
                </div>`;
            });
            
            html += `</div>`;
        }
        
        html += `</div>`;
        this.verificationStatus.innerHTML = html;
    }

    displayBackendRiskAssessment(assessment, metadata) {
        let html = `<div class="risk-analysis-grounded">`;
        
        const riskLevel = this.extractRiskLevel(assessment);
        
        html += `<div class="risk-level risk-${riskLevel}" style="margin-bottom: 15px;">
            <i class="fas fa-shield-alt"></i>
            <span style="font-size: 1.1rem;">Risk Level: ${riskLevel.toUpperCase()}</span>
            <span style="font-size: 0.9rem; margin-left: 10px;">• Backend-Verified Assessment</span>
        </div>`;
        
        if (assessment) {
            html += `<div style="background: white; padding: 15px; border-radius: 10px; border-left: 4px solid #ea4335;">
                <h6 style="color: #ea4335; margin-bottom: 10px;">
                    <i class="fas fa-exclamation-triangle"></i> Real-time Risk Analysis
                </h6>
                <div style="line-height: 1.6;">${this.formatGeminiText(assessment)}</div>
            </div>`;
        }
        
        html += `<div style="margin-top: 10px; font-size: 0.8rem; color: #666;">
            <i class="fas fa-server"></i> Processed securely via backend API
        </div>`;
        
        html += `</div>`;
        this.riskAssessment.innerHTML = html;
    }

    displayBackendRecommendations(recommendations, groundingMetadata, metadata) {
        let html = `<div class="recommendations-grounded">`;
        
        html += `<h5 style="color: #fbbc04; margin-bottom: 15px;">
            <i class="fas fa-lightbulb"></i> Backend AI Recommendations
        </h5>`;
        
        if (recommendations) {
            html += `<div class="recommendations-content">
                ${this.formatGeminiText(recommendations)}
            </div>`;
        }
        
        html += `<div style="margin-top: 15px; text-align: center;">
            <div style="display: inline-flex; align-items: center; gap: 8px; background: #e8f0fe; color: #1a73e8; padding: 8px 16px; border-radius: 20px; font-size: 0.9rem;">
                <i class="fas fa-check-circle"></i>
                <span>Enhanced by ${metadata?.hasImage ? 'Vision AI + ' : ''}Google Search • Secure Backend Processing</span>
            </div>
        </div>`;
        
        html += `</div>`;
        this.recommendations.innerHTML = html;
    }

    formatGeminiText(text) {
        if (!text) return '';
        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/- /g, '• ')
            .replace(/(\d+\.\s)/g, '<br><strong>$1</strong>');
    }

    extractRiskLevel(text) {
        if (!text) return 'low';
        if (text.toLowerCase().includes('high')) return 'high';
        if (text.toLowerCase().includes('medium')) return 'medium';
        return 'low';
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>${message}</span>
        `;
        
        document.body.insertBefore(errorDiv, document.body.firstChild);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 7000);
    }

    resetForm() {
        this.newsInput.value = '';
        this.removeImage();
        this.resultsSection.style.display = 'none';
        this.newsInput.focus();
    }

    updateStats() {
        const current = parseInt(this.totalChecks.textContent.replace(',', ''));
        const newCount = current + 1;
        
        let currentDisplay = current;
        const increment = Math.ceil((newCount - current) / 20);
        const countUp = () => {
            if (currentDisplay < newCount) {
                currentDisplay += increment;
                this.totalChecks.textContent = Math.min(currentDisplay, newCount).toLocaleString();
                setTimeout(countUp, 50);
            } else {
                this.totalChecks.textContent = newCount.toLocaleString();
            }
        };
        countUp();
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize Backend-powered TruthLens
document.addEventListener('DOMContentLoaded', () => {
    new TruthLensGemini();
});
