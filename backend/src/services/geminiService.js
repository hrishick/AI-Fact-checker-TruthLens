const fetch = require('node-fetch');
const logger = require('../utils/logger');

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.apiUrl = process.env.GEMINI_API_URL;
        this.requestCount = 0;
        this.lastResetTime = Date.now();
        this.maxRequestsPerMinute = 15;
    }

    checkRateLimit() {
        const now = Date.now();
        const timeDiff = now - this.lastResetTime;
        
        if (timeDiff >= 60000) { // Reset every minute
            this.requestCount = 0;
            this.lastResetTime = now;
        }
        
        if (this.requestCount >= this.maxRequestsPerMinute) {
            throw new Error('Rate limit exceeded for Gemini API');
        }
        
        this.requestCount++;
    }

    async analyzeContent(content, imageData = null) {
        try {
            this.checkRateLimit();
            
            logger.info('Starting Gemini analysis', { 
                hasImage: !!imageData, 
                contentLength: content?.length || 0 
            });

            const prompt = this.buildAnalysisPrompt(content, !!imageData);
            const requestBody = this.buildRequestBody(prompt, imageData);

            const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                timeout: 30000, // 30 second timeout
            });

            if (!response.ok) {
                const errorData = await response.json();
                logger.error('Gemini API error:', errorData);
                throw new Error(`Gemini API Error: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                throw new Error('Invalid response from Gemini API');
            }

            const analysisResult = this.parseGeminiResponse(
                data.candidates[0].content.parts[0].text,
                data.candidates[0].groundingMetadata,
                content,
                !!imageData
            );

            logger.info('Gemini analysis completed successfully', {
                credibilityScore: analysisResult.credibilityScore,
                verdict: analysisResult.verdict,
                hasGrounding: !!analysisResult.groundingMetadata
            });

            return analysisResult;

        } catch (error) {
            logger.error('Gemini service error:', error);
            throw new Error(`Analysis failed: ${error.message}`);
        }
    }

    buildAnalysisPrompt(content, hasImage) {
        let prompt = '';

        if (hasImage && content) {
            // Multimodal analysis
            prompt = `You are an expert fact-checker with access to real-time Google Search results and advanced image analysis capabilities. Analyze both the provided image and text for factual accuracy, credibility, and potential misinformation.

TEXT TO ANALYZE: "${content}"
IMAGE: [Provided image for analysis]

COMPREHENSIVE MULTIMODAL ANALYSIS:

## CREDIBILITY SCORE (0-100)
Based on both image analysis and Google Search verification:
- VERIFIED FACTS with authoritative sources = 85-95%
- PARTIALLY VERIFIED with some sources = 65-80%
- CONTRADICTED by evidence = 15-30%
- UNVERIFIABLE or suspicious = 40-60%

## IMAGE AUTHENTICITY ANALYSIS
- Examine the image for signs of AI generation, manipulation, or deepfake elements
- Check for inconsistencies in lighting, shadows, reflections, and image quality
- Analyze metadata indicators and compression artifacts
- Look for unnatural patterns typical of AI-generated content
- Assess image-text consistency and contextual accuracy

## SEARCH VERIFICATION DETAILS
- Cross-reference image content with Google Search results
- Verify if this is a legitimate news photo or stock image
- Check for reverse image search results and original sources
- Look for similar images or variations across the web

## FAKE/MANIPULATED IMAGE DETECTION
- AI Generation Probability: [HIGH/MEDIUM/LOW]
- Deepfake Detection: [DETECTED/NOT_DETECTED/UNCERTAIN]
- Image Manipulation Signs: [LIST ANY DETECTED]
- Authenticity Assessment: [AUTHENTIC/SUSPICIOUS/LIKELY_FAKE]

## MISINFORMATION ANALYSIS
- Risk Level: [HIGH/MEDIUM/LOW]
- Pattern detection (sensationalism, emotional manipulation, etc.)
- Comparison with known misinformation on this topic
- Social media spread patterns if relevant

## VERDICT
[CREDIBLE/FALSE/MISLEADING/UNCERTAIN/AI_GENERATED/MANIPULATED]

## SOURCE RECOMMENDATIONS
- Most reliable sources found for this topic
- Official statements or press releases if available
- Recent credible news coverage
- Expert opinions or analysis

## CONTEXT AND EXPLANATION
Provide detailed reasoning for your assessment, including what the search results revealed and how they influenced your conclusion.

Remember: Carefully examine both visual and textual elements for consistency and authenticity.`;
        } else if (hasImage) {
            // Image-only analysis
            prompt = `You are an expert image analyst with access to real-time Google Search results. Analyze the provided image for authenticity, potential manipulation, and misinformation.

IMAGE ANALYSIS TASK:

## CREDIBILITY SCORE (0-100)
Rate the image's authenticity based on technical analysis and search verification.

## COMPREHENSIVE IMAGE ANALYSIS
- Examine for AI generation indicators (unnatural symmetry, impossible lighting, etc.)
- Check for deepfake elements, face swapping, or synthetic features
- Analyze image quality, compression artifacts, and metadata
- Look for signs of photo editing, splicing, or digital manipulation
- Assess overall visual consistency and realism

## REVERSE IMAGE SEARCH RESULTS
- Use Google Search to find the original source of this image
- Check if this image appears in legitimate news sources
- Identify if it's a stock photo, historical image, or recent photograph
- Look for any contextual misuse or misrepresentation

## AI/FAKE DETECTION ASSESSMENT
- AI Generation Probability: [HIGH/MEDIUM/LOW] with reasoning
- Manipulation Detection: [YES/NO/UNCERTAIN] with specific indicators
- Deepfake Analysis: [DETECTED/NOT_DETECTED/UNCERTAIN]
- Source Authenticity: [LEGITIMATE/QUESTIONABLE/UNKNOWN]

## VERDICT AND RECOMMENDATIONS
Final assessment of image authenticity and recommended actions for verification.`;
        } else {
            // Text-only analysis
            prompt = `You are an expert fact-checker with access to real-time Google Search results. Perform a comprehensive analysis of the following content for factual accuracy, credibility, and potential misinformation.

CONTENT TO ANALYZE: "${content}"

IMPORTANT SCORING GUIDELINES:
- If Google Search CONFIRMS the information as accurate and current: Score 85-95%
- If the information is PARTIALLY verified but needs context: Score 65-80%  
- If Google Search shows CONTRADICTORY information: Score 15-30%
- If NO reliable sources found or unverifiable: Score 40-60%

Use Google Search to verify facts, check recent developments, and cross-reference information. Provide your analysis in this structure:

## CREDIBILITY SCORE (0-100)
Based on Google Search verification, provide a precise score:
- VERIFIED FACTS with multiple authoritative sources = 85-95%
- PARTIALLY VERIFIED with some authoritative sources = 65-80%
- CONTRADICTED by authoritative sources = 15-30%
- UNVERIFIABLE or mixed signals = 40-60%

## SEARCH VERIFICATION DETAILS
- List specific authoritative sources found via Google Search
- Quote key facts that were verified or contradicted
- Mention if this is recent/breaking news vs established fact
- Note the consistency across multiple sources

## FACT VERIFICATION STATUS
- Search for and verify key claims made in the content
- Check against recent news and authoritative sources
- Identify any outdated or incorrect information
- Note if this relates to recent events or breaking news

## REAL-TIME SEARCH FINDINGS
- What did Google Search reveal about this topic?
- Are there recent developments or updates?
- Do authoritative sources support or contradict the claims?
- Any breaking news or latest information related to this?

## MISINFORMATION ANALYSIS
- Risk Level: [HIGH/MEDIUM/LOW]
- Pattern detection (sensationalism, emotional manipulation, etc.)
- Comparison with known misinformation on this topic
- Social media spread patterns if relevant

## VERDICT
Choose based on search results:
- CREDIBLE: If Google Search confirms with authoritative sources
- FALSE: If Google Search contradicts with reliable sources  
- MISLEADING: If partially true but missing important context
- UNCERTAIN: If search results are mixed or inconclusive
- BREAKING_NEWS: If this is very recent and still developing

## SOURCE RECOMMENDATIONS
- Most reliable sources found for this topic
- Official statements or press releases if available
- Recent credible news coverage
- Expert opinions or analysis

## CONTEXT AND EXPLANATION
Provide detailed reasoning for your assessment, including:
- How Google Search results influenced your credibility score
- Which specific authoritative sources confirmed or denied the claims
- Why you assigned the particular score based on search verification

Remember: If Google Search confirms the information with multiple authoritative sources, the credibility score should be HIGH (85-95%). Do not penalize factually accurate information.`;
        }

        return prompt;
    }

    buildRequestBody(prompt, imageData) {
        const requestBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            tools: [{
                googleSearch: {}
            }],
            generationConfig: {
                temperature: 0.2,
                topK: 30,
                topP: 0.8,
                maxOutputTokens: 3072,
                candidateCount: 1
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH", 
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        };

        // Add image data if available
        if (imageData) {
            requestBody.contents[0].parts.push({
                inlineData: {
                    mimeType: imageData.mimeType,
                    data: imageData.base64Data
                }
            });
        }

        return requestBody;
    }

    parseGeminiResponse(geminiText, groundingMetadata, originalContent, hasImage) {
        const sections = {
            credibilityScore: this.extractCredibilityScore(geminiText),
            verdict: this.extractVerdict(geminiText),
            searchVerificationDetails: this.extractSection(geminiText, 'SEARCH VERIFICATION DETAILS'),
            factVerification: this.extractSection(geminiText, 'FACT VERIFICATION STATUS'),
            searchFindings: this.extractSection(geminiText, 'REAL-TIME SEARCH FINDINGS'),
            misinformationAnalysis: this.extractSection(geminiText, 'MISINFORMATION ANALYSIS'),
            sourceRecommendations: this.extractSection(geminiText, 'SOURCE RECOMMENDATIONS'),
            contextExplanation: this.extractSection(geminiText, 'CONTEXT AND EXPLANATION'),
            fullResponse: geminiText,
            originalContent: originalContent,
            timestamp: new Date().toISOString(),
            model: 'gemini-2.5-flash-multimodal',
            hasImage: hasImage
        };

        // Enhanced image analysis sections
        if (hasImage) {
            sections.imageAnalysis = this.extractSection(geminiText, 'IMAGE AUTHENTICITY ANALYSIS') || 
                                   this.extractSection(geminiText, 'COMPREHENSIVE IMAGE ANALYSIS');
            sections.fakeDetection = this.extractSection(geminiText, 'FAKE/MANIPULATED IMAGE DETECTION') ||
                                   this.extractSection(geminiText, 'AI/FAKE DETECTION ASSESSMENT');
            sections.reverseImageSearch = this.extractSection(geminiText, 'REVERSE IMAGE SEARCH RESULTS');
        }

        // Add grounding metadata
        if (groundingMetadata) {
            sections.groundingMetadata = {
                searchQueries: groundingMetadata.searchQueries || [],
                webResults: groundingMetadata.webResults || [],
                groundingSupports: groundingMetadata.groundingSupports || []
            };
        }

        // Enhanced scoring for multimodal content
        if (!sections.credibilityScore) {
            sections.credibilityScore = this.intelligentScoring(originalContent, geminiText, groundingMetadata, hasImage);
        } else {
            sections.credibilityScore = this.adjustScoreBasedOnSearch(sections.credibilityScore, geminiText, groundingMetadata);
        }
        
        if (!sections.verdict) {
            sections.verdict = this.determineVerdictFromScore(sections.credibilityScore);
        }

        if (geminiText.toLowerCase().includes('contradicted') || 
    geminiText.toLowerCase().includes('factually incorrect')) {
    sections.credibilityScore = Math.min(sections.credibilityScore || 50, 20);
    sections.verdict = 'false';
}

        return sections;
    }

    extractCredibilityScore(text) {
        const patterns = [
            /(?:CREDIBILITY SCORE|CREDIBILITY).*?(\d+)/i,
            /(\d+)%.*?(?:credible|credibility|accurate|score)/i,
            /(?:score|rating).*?(\d+)/i,
            /(\d+)\/100/,
            /verified facts.*?(\d+)-(\d+)%/i,
            /authoritative sources.*?(\d+)-(\d+)%/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                let score;
                if (match[2]) {
                    score = Math.round((parseInt(match[1]) + parseInt(match[2])) / 2);
                } else {
                    score = parseInt(match[1]);
                }
                if (score >= 0 && score <= 100) {
                    return score;
                }
            }
        }
        return null;
    }

    extractVerdict(text) {
        const verdictMatches = text.match(/(?:VERDICT|CONCLUSION).*?(CREDIBLE|FALSE|MISLEADING|UNCERTAIN|AI_GENERATED|MANIPULATED|AUTHENTIC|BREAKING_NEWS)/i);
        if (verdictMatches) {
            const verdict = verdictMatches[1].toUpperCase();
            switch (verdict) {
                case 'CREDIBLE':
                case 'AUTHENTIC': return 'true';
                case 'FALSE':
                case 'MISLEADING':
                case 'AI_GENERATED':
                case 'MANIPULATED': return 'false';
                case 'BREAKING_NEWS': return 'true';
                default: return 'uncertain';
            }
        }
        return null;
    }

    extractSection(text, sectionName) {
        const regex = new RegExp(`## ${sectionName}([\\s\\S]*?)(?=## |$)`, 'i');
        const match = text.match(regex);
        
        if (match && match[1]) {
            return match[1].trim().substring(0, 1500);
        }
        
        const fallbackRegex = new RegExp(`${sectionName}[:\\s]*([\\s\\S]*?)(?=\\n\\n|$)`, 'i');
        const fallbackMatch = text.match(fallbackRegex);
        
        if (fallbackMatch && fallbackMatch[1]) {
            return fallbackMatch[1].trim().substring(0, 1000);
        }
        
        return `Enhanced ${sectionName.toLowerCase()} analysis completed.`;
    }

    intelligentScoring(content, geminiResponse, groundingMetadata, hasImage) {
        let baseScore = 50;
        const responseText = geminiResponse.toLowerCase();
        
        const verificationIndicators = [
            { pattern: /confirmed|verified|accurate|correct|true/gi, weight: 15 },
            { pattern: /authoritative sources|official|multiple sources/gi, weight: 20 },
            { pattern: /consistent|consistently reported/gi, weight: 15 },
            { pattern: /recent|breaking news|just launched|officially announced/gi, weight: 10 },
            { pattern: /search results confirm|google search shows|search reveals/gi, weight: 25 }
        ];
        
        verificationIndicators.forEach(({ pattern, weight }) => {
            const matches = (responseText.match(pattern) || []).length;
            baseScore += matches * weight;
        });
        
        const contradictionIndicators = [
            { pattern: /contradicted|false|incorrect|inaccurate|debunked/gi, weight: -30 },
            { pattern: /no evidence|unverified|cannot confirm/gi, weight: -15 },
            { pattern: /mixed signals|conflicting|uncertain/gi, weight: -10 }
        ];
        
        contradictionIndicators.forEach(({ pattern, weight }) => {
            const matches = (responseText.match(pattern) || []).length;
            baseScore += matches * weight;
        });
        
        if (groundingMetadata) {
            if (groundingMetadata.webResults && groundingMetadata.webResults.length > 0) {
                baseScore += 20;
            }
            if (groundingMetadata.searchQueries && groundingMetadata.searchQueries.length > 0) {
                baseScore += 10;
            }
        }

        // Image-specific scoring adjustments
        if (hasImage) {
            const imageIndicators = [
                { pattern: /authentic|legitimate|real photo|genuine image/gi, weight: 20 },
                { pattern: /ai.?generated|deepfake|manipulated|fake|synthetic/gi, weight: -25 },
                { pattern: /original source|legitimate news|verified photo/gi, weight: 15 },
                { pattern: /reverse image search confirms|found in credible sources/gi, weight: 20 },
                { pattern: /no signs of manipulation|consistent lighting|natural/gi, weight: 10 },
                { pattern: /suspicious artifacts|inconsistent|unnatural patterns/gi, weight: -20 }
            ];
            
            imageIndicators.forEach(({ pattern, weight }) => {
                const matches = (responseText.match(pattern) || []).length;
                baseScore += matches * weight;
            });
        }
        
        return Math.min(95, Math.max(5, Math.round(baseScore)));
    }

    adjustScoreBasedOnSearch(originalScore, geminiResponse, groundingMetadata) {
        let adjustedScore = originalScore;
        const responseText = geminiResponse.toLowerCase();
        
        if (responseText.includes('verified') || responseText.includes('confirmed') || responseText.includes('accurate')) {
            if (originalScore < 70) {
                adjustedScore = Math.max(originalScore, 85);
            }
        }
        
        if (groundingMetadata && groundingMetadata.webResults && groundingMetadata.webResults.length >= 3) {
            if (responseText.includes('confirm') || responseText.includes('verify')) {
                adjustedScore = Math.max(adjustedScore, 80);
            }
        }
        
        if (responseText.includes('contradicted') || responseText.includes('false')) {
            adjustedScore = Math.min(adjustedScore, 25);
        }
        
        return Math.min(95, Math.max(5, Math.round(adjustedScore)));
    }

    determineVerdictFromScore(score) {
        if (score >= 80) return 'true';
        if (score <= 30) return 'false';
        return 'uncertain';
    }
}

module.exports = new GeminiService();
