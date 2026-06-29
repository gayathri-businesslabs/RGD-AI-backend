// index.js (Backend Server file)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors()); // Allows Brilliant Directories to connect to this API

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Native JSON Schema that physically restricts Gemini to collect our precise search filters
const responseSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["in_progress", "complete"],
      description: "Sets to 'in_progress' while discovery is active, and switches to 'complete' ONLY when requirements and ALL search filters are finalized."
    },
    aiMessage: {
      type: "string",
      description: "Your expert reply or follow-up question. Direct the conversation to systematically uncover: niche, stack, experience, language, location, and budget."
    },
    projectSummary: {
      type: "object",
      properties: {
        projectTitle: { 
          type: "string", 
          description: "A short, professional title for their project." 
        },
        projectDescription: { 
          type: "string", 
          description: "A highly-detailed, beautiful 2-paragraph draft specification ready for developers to read." 
        },
        recommendedTechStack: {
          type: "array",
          items: { type: "string" },
          description: "List of recommended technologies for this specific build."
        },
        developerSearchKeywords: {
          type: "array",
          items: { type: "string" },
          description: "The primary skill tag to run directory searches on (e.g. 'React', 'CRM', 'Go', 'Fintech', 'Marketplaces')."
        },
        experienceRequired: {
          type: "string",
          description: "Target experience level or years of experience. Must map to a clean category (e.g., 'Junior', 'Mid-Level', 'Senior', 'Lead' or years like '3-5 years', '5+ years')."
        },
        spokenLanguage: {
          type: "string",
          description: "Target spoken language preference identified from the client (e.g. 'English', 'Spanish', 'German' or 'No Preference')."
        },
        preferredLocation: {
          type: "string",
          description: "Target geographic location or country/timezone constraint (e.g. 'United States', 'Europe', 'Remote', 'India', etc.)."
        },
        budgetRange: {
          type: "string",
          description: "Target hourly rate or project budget gathered (e.g., '$50-$80/hr', '$100+/hr', 'Fixed Budget', or 'Under $5,000')."
        }
      },
      required: ["projectTitle", "projectDescription", "recommendedTechStack", "developerSearchKeywords", "experienceRequired", "spokenLanguage", "preferredLocation", "budgetRange"],
      description: "Must be null while status is 'in_progress', and fully populated ONLY when status becomes 'complete'."
    }
  },
  required: ["status", "aiMessage"]
};

app.post("/api/rgd-chat", async (req, res) => {
  try {
    const { message, history, preloadedContext } = req.body;

    let promptHistory = "";
    if (history && history.length > 0) {
      promptHistory = "Previous conversation history for context:\n" + 
        history.map(item => `${item.sender === 'user' ? 'Client' : 'RGD AI'}: ${item.text}`).join("\n") + "\n\n";
    }

    let contextNote = "";
    if (preloadedContext) {
      contextNote = `Context: The client initiated this chat by choosing these parameters:
      - Category: ${preloadedContext.category || 'Not specified'}
      - Option selected: ${preloadedContext.value || 'Not specified'}\n\n`;
    }

    const userInstructions = `
      ${contextNote}
      ${promptHistory}
      Client's latest input: "${message}"

      Analyze the input, maintain the conversational flow, and return your reply using the requested JSON format.
    `;

    const systemInstruction = `
      You are RGD AI, the expert client onboarding agent for "Really Good Developers".
      Review the client's responses and systematically guide them to build their requirements.
      To match them perfectly with our vetted network, you must gather these six pieces of information:
      1. What they want to build (Niche, e.g., 'E-Commerce Crochet Platform')
      2. Tech Stack (Translate to aesthetics/warm/playful/luxurious vibes if non-technical)
      3. Experience Level Wanted (Junior, Mid-Level, Senior, 5+ Years, etc.)
      4. Spoken Language Preferred (English, Spanish, etc.)
      5. Developer Location Constraints (Remote, USA-only, Europe, etc.)
      6. Budget Range (Hourly rates or fixed, e.g. $50-$80/hr)

      Do not ask all questions at once—ask them naturally one by one. Keep it engaging.
      Once you have collected requirements and all 6 key search criteria, switch status to "complete" and populate the projectSummary.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userInstructions,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema // Enforces structural JSON compliance
      }
    });

    const outputData = JSON.parse(response.text);
    res.json({ success: true, ...outputData });

  } catch (error) {
    console.error("RGD AI Error:", error);
    res.status(500).json({ success: false, error: "Something went wrong processing your request." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`RGD AI Backend running on port ${PORT}`));
```
eof

```html:RGD AI Widget Script:rgd_ai_script.html
<script>
(function () {
    // 1. List of rotating hero images (Slideshow)
    var heroImages = [
        'https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80'
    ];

    var heroTimer = null;
    var heroIndex = 0;
    
    // ==========================================
    // CONFIGURATION: YOUR BACKEND SERVER URL
    // ==========================================
    // Change this URL to point to your live hosted Render server address.
    var RGD_BACKEND_URL = "https://rgd-ai-backend.onrender.com";

    // Dynamic states to track conversation details and context
    var chatHistory = [];
    var preloadedContext = null;

    function byId(id) {
        return document.getElementById(id);
    }

    // Helper to safely display text without breaking HTML formatting
    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Safely grab key elements of the chat interface
    function getOverlayParts() {
        return {
            overlay: byId('RGDHC-ai-overlay'),
            chatBody: byId('RGDHC-chat-body'),
            chatInput: byId('RGDHC-chat-input'),
            chatSend: byId('RGDHC-chat-send')
        };
    }

    function scrollChatToBottom(chatBody) {
        if (chatBody) {
            chatBody.scrollTop = chatBody.scrollHeight;
        }
    }

    // Appends a chat bubble to the active screen
    function appendMessage(chatBody, sender, html) {
        var isUser = (sender === 'user');
        var message = document.createElement('div');
        message.className = 'RGDHC-chat-message' + (isUser ? ' is-user' : ' is-ai');
        message.innerHTML =
            '<div class="RGDHC-chat-avatar"><div class="RGDHC-avatar-circle"><i class="fa ' + (isUser ? 'fa-user' : 'fa-magic') + '"></i></div></div>' +
            '<div class="RGDHC-chat-bubble"><div class="RGDHC-bubble-inner">' + html + '</div></div>';
        chatBody.appendChild(message);
        scrollChatToBottom(chatBody);
        return message;
    }

    // Displays the animated "thinking" typing indicator dots
    function appendTyping(chatBody) {
        return appendMessage(chatBody, 'ai', '<span class="RGDHC-typing"><span></span><span></span><span></span></span>');
    }

    // Displays the final project blueprint report and builds the deep-link search redirect
    function appendFinalSpecsCard(chatBody, summary) {
        var specCard = document.createElement('div');
        specCard.className = 'RGDHC-spec-card';
        
        // Grab search criteria parameters produced by RGD AI
        var searchKeyword = summary.developerSearchKeywords[0] || "Developer";
        var exp = summary.experienceRequired || "";
        var lang = summary.spokenLanguage || "";
        var loc = summary.preferredLocation || "";
        var budget = summary.budgetRange || "";

        // Build redirect URL dynamically targeting your custom /search page filters!
        var redirectUrl = "/search?q=" + encodeURIComponent(searchKeyword) +
                          "&experience=" + encodeURIComponent(exp) +
                          "&language=" + encodeURIComponent(lang) +
                          "&location=" + encodeURIComponent(loc) +
                          "&budget=" + encodeURIComponent(budget);

        var techStackHtml = summary.recommendedTechStack.map(function(tech) {
            return '<span>' + escapeHtml(tech) + '</span>';
        }).join('');

        specCard.innerHTML = 
            '<div class="RGDHC-spec-badge"><i class="fa fa-check-circle"></i> Project Blueprint Finalized</div>' +
            '<h3 class="RGDHC-spec-title">' + escapeHtml(summary.projectTitle) + '</h3>' +
            '<div class="RGDHC-spec-desc">' + 
                '<strong>Project Scope:</strong><br>' + escapeHtml(summary.projectDescription).replace(/\n/g, '<br>') + '<br><br>' +
                '<strong>Filter Choices:</strong><br>' +
                '• Experience Wanted: ' + escapeHtml(exp) + '<br>' +
                '• Language Preference: ' + escapeHtml(lang) + '<br>' +
                '• Dev Location: ' + escapeHtml(loc) + '<br>' +
                '• Rate Constraints: ' + escapeHtml(budget) +
            '</div>' +
            '<div class="RGDHC-spec-stack">' +
                '<strong>Recommended Tech Stack</strong>' +
                '<div class="RGDHC-spec-tags">' + techStackHtml + '</div>' +
            '</div>' +
            '<a class="RGDHC-spec-button" href="' + redirectUrl + '">Find Matching Vetted Experts <i class="fa fa-arrow-right"></i></a>';
        
        chatBody.appendChild(specCard);
        scrollChatToBottom(chatBody);
    }

    function setChatEnabled(enabled) {
        var parts = getOverlayParts();
        if (!parts.chatInput || !parts.chatSend) {
            return;
        }
        parts.chatInput.disabled = !enabled;
        parts.chatSend.disabled = !enabled;
        if (enabled) {
            parts.chatInput.focus();
        }
    }

    // Sends the messages and history to your server backend (Gemini API)
    async function sendRequestToAI(messageText) {
        var parts = getOverlayParts();
        if (!parts.chatBody) return;

        // Show typing indicator
        var typingIndicator = appendTyping(parts.chatBody);

        // --- FOOLPROOF AUTO-CORRECT SYSTEM ---
        var destinationUrl = RGD_BACKEND_URL;
        if (destinationUrl && !destinationUrl.includes("/api/rgd-chat")) {
            var cleanUrl = destinationUrl.replace(/\/+$/, "");
            destinationUrl = cleanUrl + "/api/rgd-chat";
        }

        try {
            console.log("RGD AI: Contacting API endpoint...", destinationUrl);
            var response = await fetch(destinationUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: messageText,
                    history: chatHistory.slice(0, -1), // Share previous chat records so Gemini remembers context
                    preloadedContext: preloadedContext
                })
            });

            var result = await response.json();

            // Clear typing indicator
            if (typingIndicator && typingIndicator.parentNode) {
                typingIndicator.parentNode.removeChild(typingIndicator);
            }

            if (result.success) {
                console.log("RGD AI: API response received successfully.", result);
                // Render friendly conversation bubble from AI
                appendMessage(parts.chatBody, 'ai', escapeHtml(result.aiMessage));
                
                // Add to history state so context is preserved next turn
                chatHistory.push({ sender: 'ai', text: result.aiMessage });

                // If Gemini determines discovery is finalized, present the spec cards
                if (result.status === "complete" && result.projectSummary) {
                    appendFinalSpecsCard(parts.chatBody, result.projectSummary);
                    setChatEnabled(false); // Lock input box as scope is finalized
                    parts.chatInput.placeholder = "Discovery completed successfully!";
                } else {
                    setChatEnabled(true);
                }
            } else {
                console.warn("RGD AI: API returned success: false response.", result);
                appendMessage(parts.chatBody, 'ai', "Sorry, I am having trouble processing your query. Please try again!");
                setChatEnabled(true);
            }
        } catch (error) {
            console.error("RGD AI: API connection failed catch block:", error);
            if (typingIndicator && typingIndicator.parentNode) {
                typingIndicator.parentNode.removeChild(typingIndicator);
            }
            appendMessage(parts.chatBody, 'ai', "Unable to connect to RGD AI servers. Please verify your backend server is online.");
            setChatEnabled(true);
        }
    }

    // Opens chat modal and triggers RGD AI to speak
    function openAi(promptText, clickedCardContext) {
        console.log("RGD AI: Triggering openAi() block with prompt:", promptText);
        var parts = getOverlayParts();
        
        if (!parts.overlay) {
            console.error("RGD AI ERROR: The main overlay element #RGDHC-ai-overlay was not found in the DOM!");
            return;
        }
        if (!parts.chatBody || !parts.chatInput || !parts.chatSend) {
            console.error("RGD AI ERROR: Found the overlay, but missing internal chat DOM components!", parts);
            return;
        }

        if (parts.overlay.parentNode !== document.body) {
            console.log("RGD AI: Appending overlay directly to document.body for CSS structure safety.");
            document.body.appendChild(parts.overlay);
        }

        var normalizedPrompt = (promptText && String(promptText).trim()) 
            ? String(promptText).replace(/\s+/g, ' ').trim() 
            : 'Hi';

        // Set contextual object details if client initiated from option cards
        preloadedContext = clickedCardContext || null;

        parts.overlay.style.backgroundColor = '#ffffff';
        parts.overlay.className = 'RGDHC-ai-open';
        parts.overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('RGDHC-ai-locked');

        // Clear previous state
        parts.chatBody.innerHTML = '';
        parts.chatInput.value = '';
        parts.chatInput.placeholder = 'Type your answer here...';
        chatHistory = []; 
        setChatEnabled(false);

        // Append client's starting message
        appendMessage(parts.chatBody, 'user', escapeHtml(normalizedPrompt));
        chatHistory.push({ sender: 'user', text: normalizedPrompt });

        // Dispatch initial callout to server backend
        sendRequestToAI(normalizedPrompt);
    }

    function closeAi() {
        console.log("RGD AI: Closing chat overlay.");
        var parts = getOverlayParts();
        if (!parts.overlay) {
            return;
        }
        parts.overlay.className = '';
        parts.overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('RGDHC-ai-locked');
        chatHistory = [];
        preloadedContext = null;
    }

    function sendChatMessage() {
        var parts = getOverlayParts();
        if (!parts.chatBody || !parts.chatInput || !parts.chatSend) {
            return;
        }
        var value = parts.chatInput.value.replace(/\s+/g, ' ').trim();
        if (!value) {
            return;
        }

        console.log("RGD AI: Sending client reply message:", value);
        // Show user's input bubble instantly
        appendMessage(parts.chatBody, 'user', escapeHtml(value));
        chatHistory.push({ sender: 'user', text: value });
        
        parts.chatInput.value = '';
        setChatEnabled(false);

        // Submit client response dynamically
        sendRequestToAI(value);
    }

    function startHeroRotation() {
        var frame = byId('RGDHC-hero-frame');
        var image = byId('RGDHC-hero-image');
        if (!frame || !image || heroImages.length < 2) {
            return;
        }
        if (heroTimer) {
            window.clearInterval(heroTimer);
        }
        heroTimer = window.setInterval(function () {
            frame.className = frame.className + ' is-changing';
            window.setTimeout(function () {
                heroIndex = (heroIndex + 1) % heroImages.length;
                image.src = heroImages[heroIndex];
                frame.className = frame.className.replace(/\s*is-changing/g, '');
            }, 180);
        }, 4000);
    }

    function bindHeroAi() {
        var input = byId('RGDHC-hero-input');
        var button = byId('RGDHC-hero-button');
        if (button) {
            button.onclick = function (event) {
                if (event && event.preventDefault) {
                    event.preventDefault();
                }
                var inputVal = input ? input.value : '';
                console.log("RGD AI: Hero button clicked. Input value:", inputVal);
                openAi(inputVal, null);
            };
        }
        if (input) {
            input.onkeydown = function (event) {
                event = event || window.event;
                if (event.key === 'Enter' || event.keyCode === 13) {
                    if (event.preventDefault) {
                        event.preventDefault();
                    }
                    console.log("RGD AI: Hero input enter pressed. Input value:", input.value);
                    openAi(input.value, null);
                }
            };
        }
    }

    function closestPromptElement(element) {
        while (element && element !== document) {
            if (element.getAttribute && element.getAttribute('data-rgd-prompt')) {
                return element;
            }
            element = element.parentNode;
        }
        return null;
    }

    // Helper to find the parent element with a specific CSS class
    function closestByClass(element, className) {
        while (element && element !== document) {
            if (element.className && (' ' + element.className + ' ').indexOf(' ' + className + ' ') !== -1) {
                return element;
            }
            element = element.parentNode;
        }
        return null;
    }

    // Restores original mouse hover effects to make homepage cards flip over
    function bindFlipCards() {
        var cards = document.querySelectorAll('.RGDHC-flip-card');
        var i;
        for (i = 0; i < cards.length; i++) {
            (function (card) {
                card.addEventListener('mouseenter', function () {
                    if (card.className.indexOf('is-flipped') === -1) {
                        card.className += ' is-flipped';
                    }
                });
                card.addEventListener('mouseleave', function () {
                    card.className = card.className.replace(/\s*is-flipped/g, '');
                });
            })(cards[i]);
        }
    }

    function bindPromptClicks() {
        document.addEventListener('click', function (event) {
            var target = event.target || event.srcElement;
            if (closestByClass(target, 'RGDHC-profile-link')) {
                return;
            }
            var promptEl = closestPromptElement(target);
            var flipCard = closestByClass(target, 'RGDHC-flip-card');

            // Handle direct clicks on option tags (like React, CRM, Fintech, etc.)
            if (promptEl && closestByClass(promptEl, 'RGDHC-prompt-tag')) {
                if (event.preventDefault) {
                    event.preventDefault();
                }
                event.returnValue = false;
                if (event.stopPropagation) {
                    event.stopPropagation();
                }

                var promptText = promptEl.getAttribute('data-rgd-prompt') || promptEl.textContent || '';
                
                // Extract click context dynamically (e.g. Category: "Tech Stack", Value: "React/Next.js")
                var contextObj = null;
                var headerGroup = promptEl.closest('.RGDHC-flip-back');
                if (headerGroup) {
                    var cardTitle = headerGroup.querySelector('.RGDHC-back-title');
                    var textSpan = promptEl.querySelector('span');
                    if (cardTitle && textSpan) {
                        contextObj = {
                            category: cardTitle.textContent.replace(/:/g, '').trim(),
                            value: textSpan.textContent.trim()
                        };
                    }
                }

                console.log("RGD AI: Prompt clicked. Text:", promptText, "Context:", contextObj);
                openAi(promptText, contextObj);
                return;
            }

            // Standard fallback to manually toggle flip cards if clicked outside tags (mobile support)
            if (flipCard && !promptEl) {
                if (flipCard.className.indexOf('is-flipped') === -1) {
                    flipCard.className += ' is-flipped';
                } else {
                    flipCard.className = flipCard.className.replace(/\s*is-flipped/g, '');
                }
                return;
            }

            if (!promptEl) {
                return;
            }

            if (promptEl.tagName && promptEl.tagName.toLowerCase() === 'a') {
                if (event.preventDefault) {
                    event.preventDefault();
                }
                event.returnValue = false;
            }

            var prompt = promptEl.getAttribute('data-rgd-prompt') || promptEl.textContent || '';
            openAi(prompt, null);
        });

        document.addEventListener('keydown', function (event) {
            event = event || window.event;
            var key = event.key || '';
            var code = event.keyCode;
            if (!(key === 'Enter' || key === ' ' || code === 13 || code === 32)) {
                return;
            }
            var target = event.target || event.srcElement;
            var promptEl = closestPromptElement(target);
            var flipCard = closestByClass(target, 'RGDHC-flip-card');
            
            if (flipCard && !promptEl) {
                if (event.preventDefault) {
                    event.preventDefault();
                }
                if (flipCard.className.indexOf('is-flipped') === -1) {
                    flipCard.className += ' is-flipped';
                } else {
                    flipCard.className = flipCard.className.replace(/\s*is-flipped/g, '');
                }
                return;
            }

            if (!promptEl) {
                return;
            }

            if (event.preventDefault) {
                event.preventDefault();
            }
            openAi(promptEl.getAttribute('data-rgd-prompt') || promptEl.textContent || '', null);
        });
    }

    function bindChatControls() {
        var closeButton = byId('RGDHC-ai-close');
        var sendButton = byId('RGDHC-chat-send');
        var input = byId('RGDHC-chat-input');

        if (closeButton) {
            closeButton.onclick = closeAi;
        }
        if (sendButton) {
            sendButton.onclick = sendChatMessage;
        }
        if (input) {
            input.onkeydown = function (event) {
                event = event || window.event;
                if ((event.key === 'Enter' || event.keyCode === 13) && !input.disabled) {
                    if (event.preventDefault) {
                        event.preventDefault();
                    }
                    sendChatMessage();
                }
            };
        }
        document.addEventListener('keydown', function (event) {
            event = event || window.event;
            if (event.key === 'Escape' || event.keyCode === 27) {
                closeAi();
            }
        });
    }

    function init() {
        console.log("RGD AI: Initializing homepage widget scripts...");
        window.BDGSRgdAiTrigger = openAi;
        window.RGDHCOpenAI = openAi;
        if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            startHeroRotation();
        }
        bindHeroAi();
        bindFlipCards();
        bindPromptClicks();
        bindChatControls();
        if (window.__BDGS_T16_RGD_pendingPrompt) {
            console.log("RGD AI: Pending prompt found on load, opening chat drawer...");
            openAi(window.__BDGS_T16_RGD_pendingPrompt, null);
            window.__BDGS_T16_RGD_pendingPrompt = '';
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();
</script>