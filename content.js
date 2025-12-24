/**
 * Emotional-Cognitive Psycholinguistic Model (ECPM) based escalation detection
 * Based on: "Predicting Escalation in Political Discourse: An Emotional-Cognitive Psycholinguistic Model"
 * 
 * Two main dimensions:
 * 1. Cognitive: Argumentative talk (absolute truths) vs Subjective talk
 * 2. Emotional: Blame (projecting negative emotions) vs Self-accountability
 */

// ===== DATA LOGGING FUNCTIONS =====

/**
 * Extract context about the post/comment being replied to
 * Returns "new" for original posts, or the original post content for replies
 */
function getPostContext() {
  let originalPostContent = '';
  let originalPostWriter = '';
  let isReply = false;
  
  try {
    // For Twitter/X - check if we're replying or creating a new post
    if (isTwitter()) {
      // Look for "Replying to" text indicator - this is the most reliable way to detect replies
      const allText = document.body ? document.body.innerText || '' : '';
      const hasReplyingTo = /Replying to\s+@?\w+/i.test(allText);
      
      // Also check for reply-specific elements near the composer
      const composerArea = document.querySelector('[data-testid="tweetTextarea_0"]')?.closest('div[role="dialog"], div[data-testid="toolBar"]')?.parentElement;
      const replyIndicator = composerArea ? Array.from(composerArea.querySelectorAll('*')).find(el => 
        el.textContent && /Replying to/i.test(el.textContent)
      ) : null;
      
      if (hasReplyingTo || replyIndicator) {
        isReply = true;
        
        // Try to find the tweet we're replying to (only in reply context)
        const tweetTextElements = document.querySelectorAll('[data-testid="tweetText"]');
        if (tweetTextElements.length > 0) {
          // Find the tweet text that's closest to the reply indicator or in the same container
          let targetTweet = tweetTextElements[0];
          
          // Try to find tweet in the same thread/container as the composer
          if (composerArea) {
            const tweetInComposerArea = Array.from(tweetTextElements).find(tweet => 
              composerArea.contains(tweet.closest('article'))
            );
            if (tweetInComposerArea) {
              targetTweet = tweetInComposerArea;
            }
          }
          
          originalPostContent = targetTweet.textContent || '';
        }
        
        // Try to find the author of the tweet being replied to
        const authorElements = document.querySelectorAll('[data-testid="User-Name"]');
        if (authorElements.length > 0) {
          // Get author near the tweet we found
          const tweetArticle = tweetTextElements[0]?.closest('article');
          if (tweetArticle) {
            const authorInArticle = tweetArticle.querySelector('[data-testid="User-Name"]');
            if (authorInArticle) {
              originalPostWriter = authorInArticle.textContent || '';
            }
          }
          
          // Fallback to first author if we couldn't find one in the article
          if (!originalPostWriter && authorElements.length > 0) {
            originalPostWriter = authorElements[0].textContent || '';
          }
        }
        
        // Extract username from "Replying to @username" text if we haven't found it
        if (replyIndicator && !originalPostWriter) {
          const replyText = replyIndicator.textContent || '';
          const usernameMatch = replyText.match(/Replying to\s+(@?\w+)/i);
          if (usernameMatch) {
            originalPostWriter = usernameMatch[1].startsWith('@') ? usernameMatch[1] : '@' + usernameMatch[1];
          }
        }
      } else {
        // No "Replying to" indicator found - this is a new post
        isReply = false;
        originalPostContent = 'new';
        originalPostWriter = 'new';
      }
    }
    
    // For Facebook - different selectors
    if (!isReply && /facebook\.com/i.test(window.location.hostname)) {
      const fbPostElements = document.querySelectorAll('[data-ad-preview="message"]');
      if (fbPostElements.length > 0) {
        // Check if we're replying to a comment
        const replyIndicator = document.querySelector('[aria-label*="reply" i], [aria-label*="comment" i]');
        if (replyIndicator) {
          isReply = true;
          originalPostContent = fbPostElements[0].textContent || '';
        } else {
          isReply = false;
          originalPostContent = 'new';
          originalPostWriter = 'new';
        }
      } else {
        // No post found, assume new post
        isReply = false;
        originalPostContent = 'new';
        originalPostWriter = 'new';
      }
    }
    
    // If no context detected and we haven't determined it's a new post yet
    if (!originalPostContent && !isReply) {
      originalPostContent = 'new';
      originalPostWriter = 'new';
    }
  } catch (error) {
    console.warn('Could not extract post context:', error);
    // On error, assume it's a new post
    originalPostContent = 'new';
    originalPostWriter = 'new';
  }
  
  return {
    originalPostContent: originalPostContent ? originalPostContent.substring(0, 500) : 'new',
    originalPostWriter: originalPostWriter ? originalPostWriter.substring(0, 100) : 'new',
    isReply: isReply
  };
}

function detectPlatformName() {
  const host = window.location.hostname;
  if (/twitter\.com|x\.com/i.test(host)) return 'twitter';
  if (/facebook\.com/i.test(host)) return 'facebook';
  if (/instagram\.com/i.test(host)) return 'instagram';
  if (/reddit\.com/i.test(host)) return 'reddit';
  return host || 'unknown';
}

/**
 * Log interaction data to background script for Google Sheets
 */
async function logInteraction(data) {
  try {
    const postContext = getPostContext();
    
    // Handle new posts vs replies
    const originalPostContent = postContext.isReply 
      ? postContext.originalPostContent 
      : 'new';
    const originalPostWriter = postContext.isReply 
      ? postContext.originalPostWriter 
      : 'new';
    
    const logData = {
      date: new Date().toISOString(),
      original_post_content: originalPostContent,
      original_post_writer: originalPostWriter,
      user_original_text: data.usersOriginalContent || '',
      rephrase_suggestion: data.rephraseSuggestion || '',
      did_user_accept: data.didUserAccept || 'no',
      escalation_type: data.escalationType || 'unknown',
      platform: detectPlatformName(),
      context: window.location.href,
      post_type: postContext.isReply ? 'reply' : 'new_post'
    };
    
    console.log('📊 Logging interaction:', logData);
    console.log(`📝 Post type: ${postContext.isReply ? 'Reply' : 'New Post'}`);
    
    // Send to background script
    // Check if chrome runtime is available
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      console.warn('⚠️ Chrome runtime not available - cannot log interaction');
      return;
    }
    
    try {
      chrome.runtime.sendMessage({
        type: 'LOG_INTERACTION',
        data: logData
      }, (response) => {
        if (chrome.runtime.lastError) {
          // Handle extension context invalidated error
          if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
            console.warn('⚠️ Extension context invalidated - interaction not logged. Please reload the extension.');
          } else {
            console.error('❌ Error sending message:', chrome.runtime.lastError.message);
          }
          return;
        }
        if (response && response.success) {
          console.log('✅ Data logged successfully');
        }
      });
    } catch (sendError) {
      if (sendError.message && sendError.message.includes('Extension context invalidated')) {
        console.warn('⚠️ Extension context invalidated - interaction not logged. Please reload the extension.');
      } else {
        console.error('❌ Error sending message to background:', sendError);
      }
    }
  } catch (error) {
    console.error('❌ Error logging interaction:', error);
  }
}

// ===== ESCALATION DETECTION =====

function hasHighRiskKeywords(text) {
  const lowercase = text.toLowerCase();
  const keywordList = [
    "you're wrong",
    "you are wrong",
    "are wrong", // Catch "those people are wrong", "they are wrong"
    "always wrong",
    "your fault",
    "it's your fault",
    "you idiot",
    "you're an idiot",
    "you always",
    "you never",
    "i hate",
    "i can't stand",
    "this is insane",
    "shut up",
    "this makes me sick",
    "worst",
    "stupid",
    "dumb",
    "idiot",
    "moron",
    "ass",
    "asshole",
    "hate",
    "disgusting",
    "ridiculous",
    "brainwashed",
    "never work",
    "will never",
    "anyone who supports",
    "once", // Catch "once X, always X" patterns
    "always an", // Part of "always an asshole" pattern
    "forever"
  ];
  return keywordList.some((kw) => lowercase.includes(kw));
}

/**
 * Detect if text contains Hebrew characters
 */
function containsHebrew(text) {
  // Hebrew Unicode range: \u0590-\u05FF
  return /[\u0590-\u05FF]/.test(text);
}

/**
 * Detect if text contains non-Latin characters (Arabic, Hebrew, CJK, etc.)
 */
function containsNonLatin(text) {
  // Check for non-ASCII letters (excluding basic punctuation)
  return /[^\x00-\x7F]/.test(text) && /[\u0590-\u05FF\u0600-\u06FF\u4E00-\u9FFF\u3400-\u4DBF]/.test(text);
}

function isEscalating(text) {
  const trimmedText = text.trim();
  
  // Minimum length threshold
  if (trimmedText.length < 8 && !hasHighRiskKeywords(trimmedText)) {
    return { isEscalatory: false, escalationType: 'none' };
  }

  // If text contains Hebrew or other non-Latin characters, and API is enabled,
  // we should use API-based detection (but for now, allow it through for API check)
  const hasNonLatin = containsNonLatin(trimmedText);
  const hasHebrew = containsHebrew(trimmedText);
  
  // For non-English text (especially Hebrew), we rely on API for detection
  // So we return a moderate escalation score to trigger API check
  if (hasHebrew || (hasNonLatin && USE_API)) {
    // If we have substantial text in Hebrew, assume it might be escalatory
    // and let the API do the real detection
    if (trimmedText.length >= 10) {
      return { 
        isEscalatory: true, 
        escalationType: 'unknown',
        reasons: ['Non-English text detected - using API for detection'],
        requiresAPI: true // Flag to indicate API should be used
      };
    }
  }

  let escalationScore = 0;
  const reasons = [];

  // ===== COGNITIVE DIMENSION: Argumentative Talk =====
  // Pattern: Talking in absolute truths, categorical statements
  
  // 1. Absolute truth statements
  const absoluteTruthPatterns = [
    /\b(you are wrong|you're wrong)\b/i,
    /\b(you are (?:always|never|totally|completely|absolutely|so|just) wrong)\b/i, // "you are [adverb] wrong"
    /\b(you're (?:always|never|totally|completely|absolutely|so|just) wrong)\b/i,
    /\b(?:are|is) (?:always|never|totally|completely|absolutely) wrong\b/i, // General "are always wrong"
    /\b(i am right|i'm right)\b/i,
    /\b(i totally disagree|completely disagree|absolutely wrong)\b/i,
    /\b(that's not true|that is not true|that's false)\b/i,
    /\b(you don't understand|you don't get it)\b/i,
    /\b(that's ridiculous|that's absurd|that's stupid)\b/i,
    /\b(?:their|his|her) (?:ridiculous|absurd|stupid|idiotic) (?:ideas?|views?|opinions?)\b/i, // "their ridiculous ideas"
    /\bwill never work\b/i, // Absolute dismissal
    /\bwill always (?:fail|lose|be wrong)\b/i
  ];
  
  absoluteTruthPatterns.forEach(pattern => {
    if (pattern.test(trimmedText)) {
      escalationScore += 2;
      reasons.push("Absolute truth statement");
    }
  });

  // 2. Generalized/categorical statements (e.g., "the Arabs", "the Leftists", "all X")
  const generalizedPatterns = [
    /\b(the (?:arabs|palestinians|jews|israelis|leftists|rightists|republicans|democrats|liberals|conservatives))\b/i,
    /\b(all (?:arabs|palestinians|jews|israelis|leftists|rightists|republicans|democrats|liberals|conservatives|of them|of you))\b/i,
    /\b(every (?:arab|palestinian|jew|israeli|leftist|rightist|republican|democrat|liberal|conservative))\b/i,
    /\b(they all|you all|all of you|all of them)\b/i,
    /\b(?:those|these) (?:people|guys|folks) (?:on the (?:other side|left|right))\b/i, // "those people on the other side"
    /\b(?:anyone|everyone|everybody) who (?:supports?|believes?|thinks?|agrees?)\b/i, // "anyone who supports"
    // "You [group]" patterns - direct address creating us vs them
    /\b(you (?:lefties?|righties?|libs?|conservatives?|republicans?|democrats?|liberals?|progressives?|leftists?|rightists?|arabs?|palestinians?|jews?|israelis?|zionists?))\b/i, // "you lefties", "you libs", etc.
    /\b(you (?:people|guys|folks|ones) (?:on the (?:left|right|other side)))\b/i, // "you people on the left"
    /\b(you (?:left|right|liberal|conservative) (?:people|guys|folks|ones|snowflakes|nutjobs|wackos))\b/i // "you left people", "you conservative nutjobs"
  ];
  
  generalizedPatterns.forEach(pattern => {
    if (pattern.test(trimmedText)) {
      escalationScore += 2;
      reasons.push("Generalized/categorical statement");
    }
  });

  // 3. Categorical/absolute language
  const categoricalWords = [
    /\b(always|never|everyone|nobody|nothing|everything)\b/i,
    /\b(only|solely|exclusively|completely|totally|absolutely|definitely|certainly)\b/i
  ];
  
  // Catch "once X, always X" pattern (categorical absolutism)
  const onceAlwaysPattern = /\bonce (?:an? |a )?\w+, (?:always|forever) (?:an? |a )?\w+/i;
  if (onceAlwaysPattern.test(trimmedText)) {
    escalationScore += 2.5;
    reasons.push("Categorical absolutist pattern (once X, always X)");
  }
  
  // Count occurrences of categorical words
  let categoricalCount = 0;
  categoricalWords.forEach(pattern => {
    const matches = trimmedText.match(new RegExp(pattern.source, 'gi'));
    if (matches) categoricalCount += matches.length;
  });
  
  // For short texts (< 50 chars), even 1 categorical word is significant
  // For longer texts, need 2+ to be significant
  if (categoricalCount >= 2) {
    escalationScore += 1.5;
    reasons.push("Multiple categorical/absolute words");
  } else if (categoricalCount === 1 && trimmedText.length < 50) {
    escalationScore += 1;
    reasons.push("Categorical/absolute language in short text");
  }

  // ===== EMOTIONAL DIMENSION: Blame =====
  // Pattern: Projecting negative emotions, judging, dismissing others

  // 1. Accusative "you" statements (blaming)
  const blamePatterns = [
    /\b(you (?:always|never|can't|don't|won't|shouldn't|are|were|did|do|have|had))\b/i,
    /\b(you (?:always|never) (?:do|say|think|act|behave))\b/i,
    /\b(you're (?:always|never|just|so|too|being))\b/i,
    /\b(you (?:lefties?|righties?|libs?|people|guys|folks) (?:always|never|can't|don't|have no|have zero))\b/i, // "you lefties have no idea", "you people always"
    /\b(you (?:lefties?|righties?|libs?|conservatives?|people|guys|folks) (?:don't understand|don't get it|don't know|have no idea))\b/i, // "you lefties don't understand"
    /\b(you (?:make|made|cause|caused|force|forced) (?:me|us|this|that)(?:\s+\w+)?)/i, // "you make me sick", "you make me angry", etc. (matches even if followed by adjective)
    /\b(you (?:make|made) (?:me|us) (?:feel )?(?:sick|angry|sad|mad|upset|disgusted|furious|annoyed|frustrated|disappointed))\b/i, // Specific emotional reactions
    /\b(it's (?:your|you're) (?:fault|problem|issue|doing))\b/i,
    /\b(?:your|you're) (?:fault|problem|issue|doing)\b/i, // "your fault", "you're wrong" without "it's"
    /\b(?:this|that|it) (?:is|was) (?:your|you're) (?:fault|problem)\b/i, // "this is your fault"
    /\b(?:absolutely|completely|totally) (?:your|you're)\b/i // "absolutely your fault"
  ];
  
  blamePatterns.forEach(pattern => {
    if (pattern.test(trimmedText)) {
      escalationScore += 2;
      reasons.push("Blaming/accusative language");
    }
  });

  // 2. Mocking/condescending patterns
  const mockingPatterns = [
    /\b(you always\.\.\.|you never\.\.\.)\b/i,
    /\b(oh please|come on|seriously|give me a break)\b/i,
    /\b(typical|of course|naturally|predictably)\b/i,
    /\b(wow|really|sure|right)\b/i  // Sarcastic when used in certain contexts
  ];
  
  mockingPatterns.forEach(pattern => {
    if (pattern.test(trimmedText)) {
      escalationScore += 1.5;
      reasons.push("Mocking/condescending tone");
    }
  });

  // 3. Dismissing others' emotions/opinions
  const dismissivePatterns = [
    /\b(that's not (?:true|real|how it works|the point))\b/i,
    /\b(you're (?:wrong|mistaken|confused|misinformed))\b/i,
    /\b(that doesn't (?:matter|count|make sense|work))\b/i,
    /\b(i don't (?:care|give a|want to hear))\b/i,
    /\b(whatever|who cares|so what)\b/i
  ];
  
  dismissivePatterns.forEach(pattern => {
    if (pattern.test(trimmedText)) {
      escalationScore += 1.5;
      reasons.push("Dismissive language");
    }
  });

  // 4. Judging/condemning language
  const judgingPatterns = [
    /\b(you're (?:terrible|awful|horrible|disgusting|pathetic|ridiculous|stupid|dumb|an idiot|a moron|an ass|an asshole))\b/i,
    /\b(you are such a (?:dumb (?:ass|asshole)|idiot|moron|jerk|fool|terrible|awful|horrible|disgusting|pathetic|ridiculous|stupid))\b/i, // "you are such a dumb ass", "you are such a idiot", etc.
    /\b(you are (?:so |such )?(?:terrible|awful|horrible|disgusting|pathetic|ridiculous|stupid|dumb(?:ass| ass)?|idiot|moron|ass(?:hole)?|jerk|fool))\b/i, // "you are so stupid", "you are dumb", etc.
    /\b(that's (?:terrible|awful|horrible|disgusting|pathetic|ridiculous|stupid|dumb|idiotic))\b/i,
    /\b(how (?:dare|could) you)\b/i,
    /\b(you should (?:be ashamed|feel bad|know better))\b/i,
    /\b(?:is|are|was|were) (?:brainwashed|indoctrinated|deluded|insane|crazy)\b/i, // "is brainwashed", "are brainwashed"
    /\b(?:anyone|everyone) who (?:supports?|believes?|agrees?) (?:them|this|that) is (?:brainwashed|deluded|insane|crazy|stupid|an idiot)\b/i, // "anyone who supports them is brainwashed"
    // Catch standalone profanity/insults in judgmental contexts
    /\b(?:once|once a) (?:an? )?(?:asshole|ass|idiot|moron|jerk|fool|bastard), (?:always|forever) (?:an? )?(?:asshole|ass|idiot|moron|jerk|fool|bastard)\b/i, // "once an asshole, always an asshole"
    /\b(?:he's|she's|they're|he is|she is|they are) (?:an? )?(?:asshole|ass|idiot|moron|jerk|fool|bastard)\b/i, // Third person insults
    /\b(?:just )?(?:an? )?(?:asshole|bastard)\b/i // Standalone strong profanity (asshole, bastard) - these are always escalatory
  ];
  
  judgingPatterns.forEach(pattern => {
    if (pattern.test(trimmedText)) {
      escalationScore += 2;
      reasons.push("Judging/condemning language");
    }
  });

  // 5. "They" accusative statements (blaming groups)
  const theyBlamePatterns = [
    /\b(they (?:always|never|all|all of them|are|were|do|did))\b/i,
    /\b(they're (?:all|always|never|just|so|too))\b/i,
    /\b(they (?:make|made|cause|caused|force|forced) (?:me|us|this|that))\b/i
  ];
  
  theyBlamePatterns.forEach(pattern => {
    if (pattern.test(trimmedText)) {
      escalationScore += 1.5;
      reasons.push("Group blaming language");
    }
  });

  // ===== NON-VERBAL CUES =====
  
  // 1. Multiple exclamation marks (escalating energy)
  const exclamationCount = (trimmedText.match(/!/g) || []).length;
  if (exclamationCount >= 2) {
    escalationScore += 1;
    reasons.push("Multiple exclamation marks");
  }

  // 2. ALL CAPS (shouting)
  const capsRatio = (trimmedText.match(/[A-Z]/g) || []).length / trimmedText.length;
  if (capsRatio > 0.3 && trimmedText.length > 20) {
    escalationScore += 1.5;
    reasons.push("Excessive capitalization");
  }

  // 3. Multiple question marks (aggressive questioning)
  const questionCount = (trimmedText.match(/\?/g) || []).length;
  if (questionCount >= 3) {
    escalationScore += 1;
    reasons.push("Multiple aggressive questions");
  }

  // ===== COMBINATION FACTORS =====
  
  // If text has both argumentative AND blame patterns, it's highly escalatory
  const hasArgumentative = reasons.some(r => 
    r.includes("Absolute truth") || r.includes("Generalized") || r.includes("categorical")
  );
  const hasBlame = reasons.some(r => 
    r.includes("Blaming") || r.includes("Mocking") || r.includes("Dismissive") || 
    r.includes("Judging") || r.includes("Group blaming")
  );
  
  if (hasArgumentative && hasBlame) {
    escalationScore += 1; // Bonus for combination
  }

  // Threshold: Score of 2.5 or higher indicates escalation
  const isEscalatory = escalationScore >= 2.5;
  let escalationType = 'none';
  
  if (isEscalatory) {
    if (hasArgumentative && hasBlame) {
      escalationType = 'both';
    } else if (hasArgumentative) {
      escalationType = 'cognitive';
    } else if (hasBlame) {
      escalationType = 'emotional';
    } else {
      escalationType = 'other';
    }
  }
  
  // Debug logging (always show score for texts longer than 10 chars)
  if (trimmedText.length > 10) {
    if (isEscalatory) {
      console.log(`🚨 Escalation detected (score: ${escalationScore.toFixed(1)})`, {
        text: trimmedText.substring(0, 100) + (trimmedText.length > 100 ? '...' : ''),
        reasons: reasons,
        escalationType
      });
    } else {
      console.log(`✓ No escalation (score: ${escalationScore.toFixed(1)} < 2.5)`, {
        text: trimmedText.substring(0, 50),
        reasons: reasons.length > 0 ? reasons : ['none']
      });
    }
  }
  
  return {
    isEscalatory,
    escalationType,
    reasons
  };
}

function isTwitter() {
  // Check if we're on Twitter/X
  return window.location.hostname.includes('twitter.com') || 
         window.location.hostname.includes('x.com');
}

function getTextContent(element) {
  // More robust text extraction for contenteditable elements
  // Handles nested elements, br tags, and other HTML structures
  if (!element) return "";
  
  // For textareas, use value
  if (element.tagName === 'TEXTAREA') {
    return (element.value || "").trim();
  }
  
  // Try innerText first (handles formatting better)
  let text = element.innerText || element.textContent || "";
  
  // Fallback: manually extract text if needed
  if (!text || text.trim().length === 0) {
    text = element.textContent || "";
  }
  
  // For Facebook's lexical editor, might need to check nested spans
  if (text.trim().length === 0 && element.querySelector) {
    const spans = element.querySelectorAll('span[data-text="true"]');
    if (spans.length > 0) {
      text = Array.from(spans).map(s => s.textContent).join(' ');
    }
  }
  
  // Replace multiple whitespace/newlines with single space
  text = text.replace(/\s+/g, " ").trim();
  
  return text;
}

function setCaretToEnd(element) {
  if (!element) return;
  if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    const length = element.value.length;
    element.setSelectionRange(length, length);
    element.focus?.({ preventScroll: true });
    return;
  }
  if (element.isContentEditable || element.getAttribute?.('role') === 'textbox') {
    const selection = window.getSelection();
    if (!selection) return;
    try {
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      element.focus?.({ preventScroll: true });
    } catch (err) {
      console.warn("Failed to set caret:", err);
    }
  }
}

// Store reference to the element being checked
let currentElementBeingChecked = null;
// Flag to prevent tooltip from showing immediately after rephrasing
let justRephrased = false;
let rephraseTimeout = null;

function checkForEscalation(element) {
  const text = getTextContent(element);
  
  console.log("🔍 checkForEscalation called - text length:", text?.length || 0);
  
  if (!text || text.trim().length === 0) {
    console.log("⚠️ No text to check (empty)");
    return; // Don't check empty text
  }
  
  // Skip check if we just rephrased (give it a moment)
  if (justRephrased) {
    console.log("⚠️ Skipping check - just rephrased flag is set");
    return;
  }
  
  // Store reference for rephrasing
  currentElementBeingChecked = element;
  
  // ALWAYS log what we're checking for debugging
  console.log("🔍 Checking text:", text.substring(0, 100) + (text.length > 100 ? '...' : ''));
  console.log("📏 Text length:", text.length);
  
  const escalationResult = isEscalating(text);
  
  console.log("📊 Escalation result:", {
    isEscalatory: escalationResult.isEscalatory,
    escalationType: escalationResult.escalationType,
    reasons: escalationResult.reasons
  });
  
  if (escalationResult.isEscalatory) {
    console.log("🚨 Escalation detected - showing warning tooltip");
    console.log("📝 Requires API:", escalationResult.requiresAPI || false);
    createEscalationTooltip(text, element, escalationResult.escalationType);
  } else {
    console.log("✅ No escalation detected");
    const existingTooltip = document.querySelector(".escalation-tooltip");
    if (existingTooltip) {
      existingTooltip.remove();
    }
    justRephrased = false;
  }
}

/**
 * Call proxy server to rephrase text using ECPM prompt
 * API key is handled server-side by the proxy
 */
async function rephraseViaAPI(text) {
  try {
    // Check if API is enabled and config is available
    if (typeof USE_API === 'undefined' || !USE_API) {
      console.log('⚠️ API is disabled, using fallback rephrasing');
      return null;
    }
    
    if (typeof API_CONFIG === 'undefined' || typeof ECPM_PROMPT === 'undefined') {
      console.error('❌ API_CONFIG or ECPM_PROMPT not found in config.js');
      return null;
    }
    
    if (typeof PROXY_SERVER_URL === 'undefined' || !PROXY_SERVER_URL) {
      console.error('❌ PROXY_SERVER_URL not configured in config.js');
      console.error('   Please set PROXY_SERVER_URL to your proxy server deployment URL');
      return null;
    }
    
    // Prepare request to proxy server
    const requestBody = {
      text: text,
      model: API_CONFIG.model || 'gpt-4o',
      temperature: API_CONFIG.temperature || 1.0,
      max_tokens: API_CONFIG.max_tokens || 2048,
      top_p: API_CONFIG.top_p || 1.0,
      prompt: ECPM_PROMPT // Send the full prompt template (proxy will replace {TEXT})
    };
    
    console.log('🤖 Calling proxy server for rephrasing...');
    console.log('📡 Proxy URL:', PROXY_SERVER_URL);
    console.log('📝 Model:', requestBody.model);
    console.log('📝 Text length:', text.length);
    console.log('📝 Parameters:', {
      temperature: requestBody.temperature,
      max_tokens: requestBody.max_tokens,
      top_p: requestBody.top_p
    });
    
    // Call proxy server with retry logic for rate limits
    let response;
    let lastError = null;
    const maxRetries = 2;
    const baseDelay = 2000; // 2 seconds
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        // Wait before retry (exponential backoff)
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ Rate limited. Waiting ${delay/1000}s before retry ${attempt}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      response = await fetch(`${PROXY_SERVER_URL}/api/rephrase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      // If successful or not a rate limit error, break out of retry loop
      if (response.ok || response.status !== 429) {
        break;
      }
      
      // Rate limited - will retry if attempts remain
      lastError = await response.json().catch(() => ({ error: 'Rate limit exceeded' }));
      console.warn(`⚠️ Rate limit hit (attempt ${attempt + 1}/${maxRetries + 1})`);
    }
    
    if (!response.ok) {
      const errorData = lastError || await response.json().catch(() => ({ error: 'Unknown error' }));
      
      // Better error logging
      if (response.status === 401) {
        console.error('❌ Authentication error (401): Invalid API key on server');
        console.error('📝 Error details:', errorData.details || errorData.error || 'Unknown error');
        console.error('💡 Please check that GEMINI_API_KEY is correctly set in Render environment variables');
      } else if (response.status === 429) {
        console.error('⚠️ Rate limit exceeded after retries. Gemini API is busy.');
        console.error('💡 Please wait 30-60 seconds and try again. This is a limitation of the Gemini API.');
      } else if (response.status === 504) {
        console.error('⚠️ Request timeout. The proxy server did not respond in time.');
      } else {
        console.error('❌ Proxy server error:', response.status);
        console.error('📝 Error details:', errorData.details || errorData.error || errorData.message || JSON.stringify(errorData));
        if (errorData.stack) {
          console.error('📚 Stack trace:', errorData.stack);
        }
      }
      
      return null;
    }
    
    const parsed = await response.json();
    
    console.log('📥 Proxy server response received');
    console.log('📄 Response keys:', Object.keys(parsed || {}));
    
    // Parse JSON response
    if (parsed) {
      try {
        console.log('✅ Successfully received response from proxy:', parsed);
        
        // Extract rephrased text
        if (parsed && parsed.rephrasedText) {
          let rephrased = parsed.rephrasedText.trim();
          
          // If original text was Hebrew, ensure rephrased text is entirely in Hebrew
          // VERY AGGRESSIVE cleanup to remove all English
          if (containsHebrew(text)) {
            console.log('🔍 Original Hebrew text detected, cleaning response...');
            console.log('📝 Original rephrased text:', rephrased);
            
            // Step 1: Find the first Hebrew character and remove EVERYTHING before it (most important!)
            const firstHebrewIndex = rephrased.search(/[\u0590-\u05FF]/);
            if (firstHebrewIndex >= 0) {
              console.log(`🗑️ Removing ${firstHebrewIndex} characters before first Hebrew character`);
              rephrased = rephrased.substring(firstHebrewIndex);
              // Also remove any punctuation/commas at the start after Hebrew begins
              rephrased = rephrased.replace(/^[\s,.:;!?-]+/, '');
            } else {
              // No Hebrew found at all - this is a problem, but try to clean anyway
              console.warn('⚠️ No Hebrew characters found in response!');
            }
            
            // Step 2: Remove ALL English text patterns at the start (before any Hebrew)
            // This catches anything that might have slipped through
            rephrased = rephrased.replace(/^[^\u0590-\u05FF]*([\u0590-\u05FF])/, '$1');
            
            // Step 3: Remove common English prefixes/phrases (case insensitive, with punctuation)
            const englishPhrases = [
              /^In my view[,\s.:;!?-]*/i,
              /^I see[,\s.:;!?-]*/i,
              /^I think[,\s.:;!?-]*/i,
              /^I feel[,\s.:;!?-]*/i,
              /^I believe[,\s.:;!?-]*/i,
              /^From my perspective[,\s.:;!?-]*/i,
              /^In my opinion[,\s.:;!?-]*/i,
              /^I understand that[,\s.:;!?-]*/i,
              /^I would say[,\s.:;!?-]*/i,
              /^I believe that[,\s.:;!?-]*/i,
              /^In my experience[,\s.:;!?-]*/i,
              /^To me[,\s.:;!?-]*/i,
              /^As I see it[,\s.:;!?-]*/i,
              /^From where I stand[,\s.:;!?-]*/i,
              /^In my[,\s.:;!?-]*/i,  // Catch "In my" as a general pattern
            ];
            
            // Apply each regex pattern multiple times until nothing matches
            let changed = true;
            let iterations = 0;
            while (changed && iterations < 10) {
              changed = false;
              for (const pattern of englishPhrases) {
                const before = rephrased;
                rephrased = rephrased.replace(pattern, '').trim();
                if (before !== rephrased) {
                  changed = true;
                  console.log(`🗑️ Removed English phrase with pattern ${pattern}, result:`, rephrased);
                }
              }
              iterations++;
            }
            
            // Step 4: Remove any English words at the start (any sequence of Latin letters)
            rephrased = rephrased.replace(/^[A-Za-z]+(\s+[A-Za-z]+)*[,\s.:;!?-]*/i, '').trim();
            
            // Step 5: Remove ALL English words anywhere in the text
            // Split by whitespace and rebuild with only Hebrew-containing parts
            let cleaned = '';
            const parts = rephrased.split(/(\s+)/);
            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              // Keep if it contains Hebrew characters
              if (/[\u0590-\u05FF]/.test(part)) {
                cleaned += part;
              }
              // Keep if it's only whitespace or punctuation
              else if (/^[\s\p{P}\u0590-\u05FF]*$/u.test(part) || /^[\s,.:;!?\-—–""''()]+$/.test(part)) {
                cleaned += part;
              }
              // Remove if it contains only Latin letters (English words)
              else if (/^[A-Za-z]+$/.test(part.trim())) {
                console.log(`🗑️ Removing English word: "${part}"`);
                // Skip it - don't add to cleaned
              }
              // Keep numbers and other symbols
              else {
                cleaned += part;
              }
            }
            rephrased = cleaned.replace(/\s+/g, ' ').trim();
            
            // Step 6: Remove surrounding quotes if they're at the edges
            rephrased = rephrased.replace(/^["'`]+|["'`]+$/g, '');
            
            // Step 7: Final aggressive pass - extract ONLY Hebrew and adjacent punctuation
            const hasEnglish = /[A-Za-z]{2,}/.test(rephrased);
            if (hasEnglish) {
              console.warn('⚠️ STILL contains English after all cleanup:', rephrased);
              
              // Find all Hebrew text segments (Hebrew + punctuation/spaces)
              const hebrewSegments = rephrased.match(/[\u0590-\u05FF][\u0590-\u05FF\s\p{P}]*[\u0590-\u05FF]|[\u0590-\u05FF]+/gu);
              if (hebrewSegments && hebrewSegments.length > 0) {
                rephrased = hebrewSegments.join(' ').replace(/\s+/g, ' ').trim();
                console.log('✅ Extracted only Hebrew segments:', rephrased);
              } else {
                // Last resort: find first Hebrew char and take everything from there
                const firstHebrewPos = rephrased.search(/[\u0590-\u05FF]/);
                if (firstHebrewPos >= 0) {
                  rephrased = rephrased.substring(firstHebrewPos);
                  // Remove any remaining English
                  rephrased = rephrased.replace(/[A-Za-z]/g, '').replace(/\s+/g, ' ').trim();
                }
              }
            }
            
            console.log('✅ Final cleaned Hebrew text:', rephrased);
            
            // Final validation
            if (containsHebrew(rephrased) && /[A-Za-z]{2,}/.test(rephrased)) {
              console.error('❌ ERROR: Cleaned text still contains English!', rephrased);
            }
          }
          
          console.log('✅ API rephrasing successful:', rephrased);
          console.log('📊 Full response:', {
            riskLevel: parsed.riskLevel,
            escalationType: parsed.escalationType,
            rephrasedLength: rephrased.length,
            containsHebrew: containsHebrew(rephrased),
            originalWasHebrew: containsHebrew(text)
          });
          return rephrased;
        } else if (parsed && parsed.isEscalatory === false) {
          console.log('ℹ️ Text is already de-escalatory, no rephrasing needed');
          return null;
        } else {
          console.warn('⚠️ Proxy response missing rephrasedText:', parsed);
          return null;
        }
      } catch (parseError) {
        console.error('❌ Error processing proxy response:', parseError);
        console.error('Response data:', parsed);
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error calling proxy server:', error);
    return null;
  }
}

/**
 * Rephrase text using ECPM de-escalation strategies:
 * 1. Transform "you are X" statements into "I" statements expressing personal perspective
 * 2. Replace absolute truths with subjective statements
 * 3. Replace blame statements with self-accountability
 * 4. Replace generalized statements with specific, personal ones
 * 5. Replace judging language with feelings and observations
 * 
 * If USE_API is true, this will call the OpenAI API. Otherwise, uses pattern matching.
 */
async function rephraseForDeEscalation(text) {
  // Try API first if enabled
  if (typeof USE_API !== 'undefined' && USE_API) {
    const apiResult = await rephraseViaAPI(text);
    if (apiResult) {
      return apiResult;
    }
    // Fallback to pattern matching if API fails
    console.log('⚠️ API rephrasing failed, falling back to pattern matching');
  }
  
  // Fallback: Pattern matching rephrasing (original implementation)
  let rephrased = text;
  
  // Store original for comparison - if nothing changes, return null to trigger error message
  const originalTextForComparison = text.trim().toLowerCase();
  
  // STEP 1: Deep transformations - "you are X" → "I feel/think/observe..."
  // These catch common accusatory patterns and transform them completely
  
  // "You are [always/never/often/...] wrong" → "I often disagree with you" or "I often disagree with your perspective"
  rephrased = rephrased.replace(/\b(?:you are|you're) (?:always|often|never|rarely|so|just|totally|completely|absolutely) wrong\b/gi, "I often disagree with your perspective");
  rephrased = rephrased.replace(/\b(?:you are|you're) wrong\b/gi, "I see it differently");
  
  // "You are [always/never] [verb]ing" → "I notice that you sometimes/rarely [verb]"
  rephrased = rephrased.replace(/\b(?:you are|you're) always (\w+ing)\b/gi, "I notice you sometimes $1");
  rephrased = rephrased.replace(/\b(?:you are|you're) never (\w+ing)\b/gi, "I notice you rarely $1");
  
  // "You are [negative adjective]" → "I'm having difficulty with this"
  rephrased = rephrased.replace(/\b(?:you are|you're) (?:terrible|awful|horrible|disgusting|pathetic|ridiculous|stupid|dumb|mean|cruel|selfish)\b/gi, "I'm having a strong reaction to this");
  
  // STEP 2: Transform "you [verb]" accusatory statements to "I" statements
  
  // "You always/never [verb]" → "I often/rarely notice that you [verb]"
  rephrased = rephrased.replace(/\byou always ([\w\s]+?)(?=\.|!|,|$)/gi, "I often notice $1");
  rephrased = rephrased.replace(/\byou never ([\w\s]+?)(?=\.|!|,|$)/gi, "I rarely see $1");
  
  // "You make me" → "I feel"
  rephrased = rephrased.replace(/\byou (?:make|made) me (feel )?([\w\s]+?)(?=\.|!|,|$)/gi, "I feel $2");
  
  // General "you [negative action]" → "I observe/notice"
  rephrased = rephrased.replace(/\byou (ignore|dismiss|attack|criticize|belittle|mock|insult)/gi, "I feel $1d");
  
  // STEP 3: Absolute truth statements → subjective statements
  rephrased = rephrased.replace(/\b(?:i am|i'm) right\b/gi, "I believe this");
  rephrased = rephrased.replace(/\b(?:that's|that is) (?:not true|false|a lie)\b/gi, "I understand it differently");
  // ECPM: Transform dismissive "you have no idea/don't know" → "I" statement with self-accountability
  // Match "you [really] have no idea [what you are/you're talking about]" as a complete phrase
  rephrased = rephrased.replace(/\byou (?:really )?have no idea(?: what (?:you are|you're) talking about)?/gi, "I see things differently, and I'm trying to understand your perspective");
  rephrased = rephrased.replace(/\byou (?:really )?(?:don't understand|don't get it|don't know|have no clue)(?: what (?:you are|you're) talking about)?/gi, "I see things differently, and I'm trying to understand your perspective");
  rephrased = rephrased.replace(/\b(?:you don't|you do not) (?:understand|get it|know)\b/gi, "I'd like to share my perspective");
  rephrased = rephrased.replace(/\b(?:that's|that is) (?:ridiculous|absurd|stupid|insane|crazy)\b/gi, "I find that challenging to understand");
  
  // STEP 4: Fault/blame statements → self-accountability
  rephrased = rephrased.replace(/\b(?:this|that|it) (?:is|was) (?:absolutely|completely|totally|all) (?:your|you're) (?:fault|problem|responsibility)\b/gi, "I'm having a hard time with this");
  rephrased = rephrased.replace(/\b(?:absolutely|completely|totally) (?:your|you're) (?:fault|problem)\b/gi, "I'm having a hard time with this");
  rephrased = rephrased.replace(/\b(?:this|that|it) (?:is|was) (?:your|you're) (?:fault|problem|responsibility)\b/gi, "I'm finding this difficult");
  rephrased = rephrased.replace(/\bit's (?:your|you're) (?:fault|problem|issue|responsibility)\b/gi, "I'm struggling with this");
  rephrased = rephrased.replace(/\b(?:your|you're) (?:fault|problem|issue|responsibility)\b/gi, "I'm struggling with this");
  
  // STEP 5: Generalized/categorical statements → specific, personal ones (ECPM: Transform to "I" statements)
  // Transform "you [group] have no idea/don't understand" FIRST as complete phrases
  // ECPM requires: Replace "you/they" with "I" statements + personal perspective + self-accountability
  rephrased = rephrased.replace(/\b(you (?:lefties?|righties?|libs?|conservatives?|republicans?|democrats?|liberals?|progressives?|leftists?|rightists?|people|guys|folks)) (?:have no idea|don't understand|don't get it|don't know|have no clue)\b/gi, (match, group) => {
    // ECPM transformation: Transform to "I" statement with personal perspective and self-accountability
    // Preserve meaning (disagreement/understanding gap) while removing categorical blame
    const groupName = group.replace(/^you /i, "").toLowerCase();
    const groupMap = {
      'lefties': 'people on the left',
      'leftists': 'people on the left',
      'righties': 'people on the right',
      'conservatives': 'conservative people',
      'republicans': 'Republicans',
      'democrats': 'Democrats',
      'liberals': 'liberal people',
      'progressives': 'progressive people',
      'libs': 'liberal people',
      'rightists': 'people on the right',
      'people': 'people',
      'guys': 'people',
      'folks': 'people'
    };
    const neutralGroup = groupMap[groupName] || `some ${groupName}`;
    // ECPM: "I" statement expressing personal perspective and self-accountability
    return `I see things differently from some ${neutralGroup}, and I'm trying to understand their perspective`;
  });
  
  // Transform "you [group]" patterns - these are the most escalatory
  rephrased = rephrased.replace(/\b(you (?:lefties?|righties?|libs?|conservatives?|republicans?|democrats?|liberals?|progressives?|leftists?|rightists?|arabs?|palestinians?|jews?|israelis?|zionists?))\b/gi, (match) => {
    const group = match.replace(/^you /i, "").toLowerCase();
    // Map common group names to more neutral descriptions
    const groupMap = {
      'lefties': 'people on the left',
      'leftists': 'people on the left',
      'righties': 'people on the right',
      'conservatives': 'conservative people',
      'republicans': 'Republicans',
      'democrats': 'Democrats',
      'liberals': 'liberal people',
      'progressives': 'progressive people',
      'libs': 'liberal people',
      'rightists': 'people on the right',
      'arabs': 'Arab people',
      'palestinians': 'Palestinians',
      'jews': 'Jewish people',
      'israelis': 'Israelis',
      'zionists': 'Zionists'
    };
    const neutralGroup = groupMap[group] || `some ${group}`;
    return `some ${neutralGroup}`;
  });
  
  // Transform "you people/guys/folks [on the left/right]"
  rephrased = rephrased.replace(/\b(you (?:people|guys|folks|ones) (?:on the (?:left|right|other side)))\b/gi, "some people on that side");
  rephrased = rephrased.replace(/\b(you (?:left|right|liberal|conservative) (?:people|guys|folks|ones))\b/gi, (match) => {
    const side = match.match(/\b(left|right|liberal|conservative)\b/i)?.[0]?.toLowerCase() || '';
    if (side === 'left' || side === 'liberal') return 'some people on the left';
    if (side === 'right' || side === 'conservative') return 'some people on the right';
    return 'some people';
  });
  
  // Transform "the [group]" or "all [group]"
  rephrased = rephrased.replace(/\b(?:the|all) (?:arabs|palestinians|jews|israelis|leftists|rightists|republicans|democrats|liberals|conservatives)\b/gi, (match) => {
    const group = match.replace(/(?:the|all) /i, "").toLowerCase();
    return `some ${group}`;
  });
  rephrased = rephrased.replace(/\ball (?:of them|of you|people)\b/gi, "some people");
  rephrased = rephrased.replace(/\bevery(?:one|body)\b/gi, "many people");
  rephrased = rephrased.replace(/\b(?:they all|you all)\b/gi, "some people");
  
  // Transform dismissive statements about groups - handle AFTER group transformation
  rephrased = rephrased.replace(/\b(some (?:people on the (?:left|right)|lefties?|righties?|libs?|conservatives?|people|leftists?|rightists?|arabs?|palestinians?|jews?|israelis?)) (?:have no idea|don't understand|don't get it|don't know)\b/gi, "$1 might not fully understand");
  rephrased = rephrased.replace(/\b(some (?:people on the (?:left|right)|lefties?|righties?|libs?|conservatives?|people|leftists?|rightists?|arabs?|palestinians?|jews?|israelis?)) (?:have no|have zero) (?:idea|clue|understanding)\b/gi, "$1 might not fully understand");
  
  // STEP 6: Replace categorical/absolute words with nuanced language
  // Note: Don't replace "always" and "never" if they were already part of a transformation above
  if (!/\b(?:often|rarely|sometimes)\b/i.test(rephrased)) {
    rephrased = rephrased.replace(/\balways\b/gi, "often");
    rephrased = rephrased.replace(/\bnever\b/gi, "rarely");
  }
  rephrased = rephrased.replace(/\beveryone\b/gi, "many people");
  rephrased = rephrased.replace(/\bnobody\b/gi, "few people");
  rephrased = rephrased.replace(/\b(?:completely|totally|absolutely|definitely|certainly)\b/gi, "largely");
  rephrased = rephrased.replace(/\b(?:only|solely|exclusively)\b/gi, "primarily");
  
  // STEP 7: Replace judging/condemning language with feelings
  rephrased = rephrased.replace(/\b(?:how (?:dare|could) you)\b/gi, "I'm surprised by this");
  rephrased = rephrased.replace(/\byou should (?:be ashamed|feel bad|know better)\b/gi, "I'm feeling hurt by this");
  
  // STEP 8: Replace dismissive language with acknowledgment
  rephrased = rephrased.replace(/\b(?:that doesn't|that does not) (?:matter|count|make sense|work)\b/gi, "I'm not sure I understand");
  rephrased = rephrased.replace(/\b(?:i don't|i do not) (?:care|give a|want to hear)\b/gi, "I'm having trouble engaging with this");
  rephrased = rephrased.replace(/\b(?:whatever|who cares|so what)\b/gi, "I'm not sure how to respond");
  
  // STEP 9: Remove ALL exclamation marks (they add emotional intensity)
  rephrased = rephrased.replace(/!/g, ".");
  
  // STEP 10: Add subjective framing if the text doesn't already have it
  if (!/\b(?:in my|i (?:think|feel|believe|see|notice|find|observe|often|rarely))\b/i.test(rephrased)) {
    // Only add if it's a statement, not a question
    if (!rephrased.trim().endsWith('?')) {
      rephrased = "In my view, " + rephrased.charAt(0).toLowerCase() + rephrased.slice(1);
    }
  }
  
  // STEP 11: Clean up punctuation - ensure proper sentence ending
  rephrased = rephrased.replace(/\.{2,}/g, "."); // Remove multiple periods
  rephrased = rephrased.replace(/\s+/g, " "); // Clean up extra spaces
  rephrased = rephrased.trim();
  
  // Make sure it ends with a period if it doesn't have ending punctuation
  if (!/[.?]$/.test(rephrased)) {
    rephrased += ".";
  }
  
  // STEP 12: Capitalize first letter
  if (rephrased.length > 0) {
    rephrased = rephrased.charAt(0).toUpperCase() + rephrased.slice(1);
  }
  
  // Check if rephrasing actually changed anything (excluding case changes and added prefixes)
  const rephrasedForComparison = rephrased.trim().toLowerCase().replace(/^(in my view,?|i think |i see )/i, '').trim();
  if (rephrasedForComparison === originalTextForComparison || rephrasedForComparison.length === 0) {
    console.warn('⚠️ Pattern matching failed to transform text, returning null to trigger error message');
    return null; // Return null so error message is shown instead of showing unchanged text
  }
  
  return rephrased;
}

// Replace text using the most reliable method for each platform
// Uses execCommand which preserves editor functionality (including deletion)
function replaceTextViaExecCommand(element, text) {
  console.log("🔧 replaceTextViaExecCommand called with:", {
    elementTag: element?.tagName,
    textLength: text?.length,
    textPreview: text?.substring(0, 50)
  });
  
  if (!element) {
    console.error("❌ No element provided to replaceTextViaExecCommand");
    return false;
  }
  
  // Ensure element is focused and editable
  element.focus({ preventScroll: true });
  console.log("📍 Element focused");
  
  try {
    const selection = window.getSelection();
    if (!selection) {
      console.error("❌ No selection object available");
      return false;
    }
    
    // Clear any existing selection first
    selection.removeAllRanges();
    console.log("📍 Selection cleared");
    
    // Select all content in the element
    const range = document.createRange();
    try {
      range.selectNodeContents(element);
      selection.addRange(range);
      console.log("📍 Selection range created and added");
    } catch (e) {
      console.warn("❌ Could not select node contents:", e);
      return false;
    }
    
    // Use execCommand to replace - this preserves editor structure
    // First, select all (redundant but helps ensure selection)
    const selectAllSuccess = document.execCommand('selectAll', false, null);
    console.log("📍 execCommand('selectAll'):", selectAllSuccess);
    
    // Delete the selected content using 'delete' command
    const deleteSuccess = document.execCommand('delete', false, null);
    console.log("📍 execCommand('delete'):", deleteSuccess);
    
    // Insert the new text using insertText - this is key for editor compatibility
    // insertText creates proper DOM structure that editors can work with
    const insertSuccess = document.execCommand('insertText', false, text);
    console.log("📍 execCommand('insertText'):", insertSuccess);
    
    if (insertSuccess) {
      console.log("✅ Text replaced successfully via execCommand");
      console.log("📍 Verification: element now contains:", getTextContent(element).substring(0, 50));
      
      // CRITICAL: Trigger events that editors need to recognize editing state
      // These events ensure deletion will work
      
      // Trigger input event
      const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: false,
        inputType: 'insertText',
        data: text
      });
      element.dispatchEvent(inputEvent);
      
      // Trigger beforeinput event
      const beforeInputEvent = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      });
      element.dispatchEvent(beforeInputEvent);
      
      // Position cursor at the end
      setTimeout(() => {
        try {
          const finalSelection = window.getSelection();
          if (finalSelection && element) {
            const finalRange = document.createRange();
            
            // Try to find the last text node
            const walker = document.createTreeWalker(
              element,
              NodeFilter.SHOW_TEXT,
              null
            );
            
            let lastTextNode = null;
            let node;
            while (node = walker.nextNode()) {
              lastTextNode = node;
            }
            
            if (lastTextNode && lastTextNode.nodeType === Node.TEXT_NODE) {
              const len = lastTextNode.textContent?.length || 0;
              finalRange.setStart(lastTextNode, len);
              finalRange.setEnd(lastTextNode, len);
            } else {
              finalRange.selectNodeContents(element);
              finalRange.collapse(false);
            }
            
            finalSelection.removeAllRanges();
            finalSelection.addRange(finalRange);
            
            // Ensure focus is maintained
            element.focus({ preventScroll: true });
            
            // Trigger additional events to "wake up" the editor's deletion handlers
            // Simulate a keypress event to ensure editor recognizes it's in edit mode
            const keyDownEvent = new KeyboardEvent('keydown', {
              bubbles: true,
              cancelable: true,
              key: 'a',
              code: 'KeyA'
            });
            element.dispatchEvent(keyDownEvent);
            
            const keyUpEvent = new KeyboardEvent('keyup', {
              bubbles: true,
              cancelable: true,
              key: 'a',
              code: 'KeyA'
            });
            element.dispatchEvent(keyUpEvent);
            
            console.log("✅ Cursor positioned and editor events triggered");
          }
          element.focus({ preventScroll: true });
        } catch (e) {
          console.warn("Could not position cursor:", e);
          element.focus({ preventScroll: true });
        }
      }, 30);
      
      return true;
    }
    
    console.log("insertText command failed");
    return false;
  } catch (e) {
    console.error("replaceTextViaExecCommand failed:", e);
    return false;
  }
}

function replaceTextInElement(element, newText) {
  if (!element) return false;
  
  console.log("🔄 Replacing text in element:", {
    tag: element.tagName,
    contenteditable: element.contentEditable,
    role: element.getAttribute('role'),
    currentText: getTextContent(element).substring(0, 50),
    innerHTMLSnippet: element.innerHTML ? element.innerHTML.substring(0, 200) : ''
  });
  
  // Preserve editability attributes BEFORE any manipulation
  const wasContentEditable = element.contentEditable;
  const originalRole = element.getAttribute('role');
  const originalSpellcheck = element.getAttribute('spellcheck');
  
  try {
    if (element.tagName === 'TEXTAREA') {
      // For textareas, use value
      element.value = newText;
      // Ensure textarea remains editable
      element.removeAttribute('readonly');
      element.removeAttribute('disabled');
      ['input', 'change', 'keyup'].forEach(eventType => {
        const event = new Event(eventType, { bubbles: true, cancelable: true });
        element.dispatchEvent(event);
      });
      setCaretToEnd(element);
      return true;
    } else if (element.contentEditable === 'true' || element.getAttribute('role') === 'textbox') {
      element.focus?.({ preventScroll: true });
      
      // For Twitter/X, ALWAYS use execCommand as it preserves editor functionality
      // (including deletion support)
      if (isTwitter()) {
        console.log("Twitter/X composer detected → using execCommand for editor compatibility");
        console.log("🔍 Current text in element:", getTextContent(element).substring(0, 50));
        console.log("🔍 New text to insert:", newText.substring(0, 50));
        
        // Store reference to element for post-processing
        const twitterElement = element;
        
        const success = replaceTextViaExecCommand(element, newText);
        
        console.log("🔍 replaceTextViaExecCommand returned:", success);
        if (success) {
          setTimeout(() => {
            const verifyText = getTextContent(element);
            if (verifyText.trim() === newText.trim() || verifyText.includes(newText.substring(0, Math.min(newText.length, 15)))) {
              console.log("✅ Twitter composer updated successfully");
              
              // Ensure editability is maintained
              if (wasContentEditable === 'true') {
                element.contentEditable = 'true';
                element.setAttribute('contenteditable', 'true');
              }
              // Restore other attributes
              if (originalRole) {
                element.setAttribute('role', originalRole);
              }
              element.removeAttribute('readonly');
              element.removeAttribute('disabled');
              
              // CRITICAL: Additional event triggers to ensure deletion works
              // Twitter's editor may need these to properly initialize deletion handlers
              setTimeout(() => {
                // Ensure element is still editable
                if (wasContentEditable === 'true') {
                  element.contentEditable = 'true';
                  element.setAttribute('contenteditable', 'true');
                }
                element.removeAttribute('readonly');
                element.removeAttribute('disabled');
                
                // Focus the element
                element.focus({ preventScroll: true });
                
                // Trigger focus event to ensure editor recognizes focus
                const focusEvent = new FocusEvent('focus', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                element.dispatchEvent(focusEvent);
                
                // Ensure selection is properly set at the end
                const sel = window.getSelection();
                if (sel && element) {
                  try {
                    const range = document.createRange();
                    const walker = document.createTreeWalker(
                      element,
                      NodeFilter.SHOW_TEXT,
                      null
                    );
                    
                    let lastTextNode = null;
                    let node;
                    while (node = walker.nextNode()) {
                      lastTextNode = node;
                    }
                    
                    if (lastTextNode) {
                      const len = lastTextNode.textContent?.length || 0;
                      range.setStart(lastTextNode, len);
                      range.setEnd(lastTextNode, len);
                    } else {
                      range.selectNodeContents(element);
                      range.collapse(false);
                    }
                    
                    sel.removeAllRanges();
                    sel.addRange(range);
                  } catch (e) {
                    console.warn("Could not set selection:", e);
                  }
                }
                
                // CRITICAL: Trigger a mock backspace keydown event (cancelled)
                // This helps Twitter's editor recognize that deletion is enabled
                // We cancel it so it doesn't actually delete anything
                const backspaceDown = new KeyboardEvent('keydown', {
                  bubbles: true,
                  cancelable: true,
                  key: 'Backspace',
                  code: 'Backspace',
                  keyCode: 8,
                  which: 8
                });
                
                // Add a listener to prevent actual deletion
                const preventDelete = (e) => {
                  if (e.key === 'Backspace') {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                };
                element.addEventListener('keydown', preventDelete, { once: true, capture: true });
                element.dispatchEvent(backspaceDown);
                
                // Also trigger keyup
                setTimeout(() => {
                  const backspaceUp = new KeyboardEvent('keyup', {
                    bubbles: true,
                    cancelable: true,
                    key: 'Backspace',
                    code: 'Backspace',
                    keyCode: 8,
                    which: 8
                  });
                  element.dispatchEvent(backspaceUp);
                  
                  // Remove the prevent listener
                  element.removeEventListener('keydown', preventDelete, { capture: true });
                  
                  console.log("✅ Twitter editor deletion handlers initialized");
                }, 10);
              }, 100);
            } else {
              console.warn("⚠️ Twitter composer verification mismatch, retrying...");
              // Retry once more
              setTimeout(() => {
                const retrySuccess = replaceTextViaExecCommand(element, newText);
                if (!retrySuccess) {
                  console.error("⚠️ execCommand retry failed, Twitter editor may have compatibility issues");
                }
              }, 200);
            }
          }, 150);
          return success;
        } else {
          // If execCommand failed, try again with a delay
          console.log("⚠️ Initial execCommand failed, retrying...");
          setTimeout(() => {
            const retrySuccess = replaceTextViaExecCommand(element, newText);
            if (retrySuccess) {
              console.log("✅ Retry succeeded");
            }
          }, 100);
          // Still return false to try other methods
          return false;
        }
      }
      
      // Ensure the full content is selected before replacement
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        try {
          range.selectNodeContents(element);
        } catch (rangeError) {
          console.warn("Could not select node contents, falling back to element:", rangeError);
          range.selectNode(element);
        }
        selection.removeAllRanges();
        selection.addRange(range);
      }
      
      // Method 0.1: Check for Facebook's Lexical editor
      const lexicalRoot = element.__lexicalEditor ? element : element.querySelector?.('[data-lexical-editor="true"]');
      const lexicalEditor = lexicalRoot && lexicalRoot.__lexicalEditor;
      if (lexicalEditor) {
        console.log("Facebook Lexical editor detected → using execCommand");
        const success = replaceTextViaExecCommand(element, newText);
        if (success) {
          setTimeout(() => {
            const verifyText = getTextContent(element);
            if (verifyText.trim() === newText.trim() || verifyText.includes(newText.substring(0, Math.min(newText.length, 15)))) {
              console.log("✅ Facebook composer updated successfully");
              // Ensure editability is maintained
              if (wasContentEditable === 'true') {
                element.contentEditable = 'true';
              }
            } else {
              console.warn("⚠️ Facebook composer verification mismatch", { expected: newText, got: verifyText });
            }
          }, 150);
        }
        return success;
      }
      
      // Method 1: execCommand (browser native, works with most editors)
      try {
        // Select all
        const selectAllSuccess = document.execCommand('selectAll', false, null);
        if (selectAllSuccess) {
          // Insert text (replaces selection)
          const insertSuccess = document.execCommand('insertText', false, newText);
          if (insertSuccess) {
            console.log("✅ Method 1 (execCommand): Success");
            // Ensure editability is maintained after execCommand
            if (wasContentEditable === 'true') {
              element.contentEditable = 'true';
            }
            // Verify it worked
            setTimeout(() => {
              const verifyText = getTextContent(element);
              if (verifyText.trim() === newText.trim() || verifyText.includes(newText.substring(0, 15))) {
                console.log("✅ Verified: Text replaced successfully");
              } else {
                console.warn("⚠️ execCommand didn't work, trying Method 2...");
                // Fallback to direct DOM manipulation
                element.textContent = newText;
                element.innerText = newText;
                // Restore editability in fallback
                if (wasContentEditable === 'true') {
                  element.contentEditable = 'true';
                }
              }
            }, 50);
            setCaretToEnd(element);
            return true;
          }
        }
      } catch (e) {
        console.log("Method 1 (execCommand) failed:", e);
      }
      
      // Method 2: Use modern InputEvent API to preserve editor functionality
      console.log("Trying Method 2: InputEvent API for editor compatibility");
      
      // For editors like Twitter/X, we should use InputEvent API which editors understand
      // This preserves deletion and other editing capabilities
      
      try {
        // Select all content first
        const selectRange = document.createRange();
        selectRange.selectNodeContents(element);
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(selectRange);
        }
        
        // Use InputEvent with deleteContentBackward to remove existing text
        // This is what browsers and editors expect
        const deleteEvent = new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'deleteContentBackward'
        });
        element.dispatchEvent(deleteEvent);
        
        // Now delete the selected content
        if (sel && sel.rangeCount > 0) {
          sel.getRangeAt(0).deleteContents();
        }
        
        // Insert new text using InputEvent with insertText
        const insertEvent = new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: newText
        });
        element.dispatchEvent(insertEvent);
        
        // Actually insert the text
        if (sel) {
          const insertRange = document.createRange();
          insertRange.selectNodeContents(element);
          insertRange.collapse(true); // Start at beginning
          sel.removeAllRanges();
          sel.addRange(insertRange);
          
          // Insert as text node (single node for better compatibility)
          const textNode = document.createTextNode(newText);
          insertRange.deleteContents();
          insertRange.insertNode(textNode);
          insertRange.setStartAfter(textNode);
          insertRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(insertRange);
        }
        
        // Trigger input event
        const inputEvent = new InputEvent('input', {
          bubbles: true,
          cancelable: false,
          inputType: 'insertText',
          data: newText
        });
        element.dispatchEvent(inputEvent);
        
        console.log("✅ Method 2 (InputEvent API): Text inserted");
        
        // Restore editability attributes
        if (wasContentEditable === 'true') {
          element.contentEditable = 'true';
          element.setAttribute('contenteditable', 'true');
        }
        if (originalRole) {
          element.setAttribute('role', originalRole);
        }
        element.removeAttribute('readonly');
        element.removeAttribute('disabled');
        
        // Position cursor at end
        setTimeout(() => {
          setCaretToEnd(element);
        }, 10);
        
        return true;
      } catch (inputEventError) {
        console.warn("InputEvent API failed, falling back to DOM manipulation:", inputEventError);
        
        // Fallback: Direct DOM manipulation (less ideal but necessary)
        // For Facebook's lexical editor - find spans BEFORE mutating
        const lexicalSpans = Array.from(element.querySelectorAll('span[data-text="true"], span[data-lexical-text="true"]'));
        
        // Clear everything first
        element.innerHTML = '';
        element.textContent = '';
        element.innerText = '';
        
        // CRITICAL: Restore contentEditable immediately after clearing
        if (wasContentEditable === 'true') {
          element.contentEditable = 'true';
          element.setAttribute('contenteditable', 'true');
        }
        if (originalRole) {
          element.setAttribute('role', originalRole);
        }
        if (originalSpellcheck) {
          element.setAttribute('spellcheck', originalSpellcheck);
        }
        
        // Remove any attributes that might prevent editing
        element.removeAttribute('readonly');
        element.removeAttribute('disabled');
        
        // Create a single text node (better for editors than multiple nodes)
        const textNode = document.createTextNode(newText);
        element.appendChild(textNode);
        
        // Set textContent as well for compatibility
        element.textContent = newText;
        
        // If we detected lexical spans earlier, update them directly as well
        if (lexicalSpans.length > 0) {
          lexicalSpans.forEach((span, index) => {
            if (index === 0) {
              span.textContent = newText;
              span.innerText = newText;
              if (span.firstChild) {
                span.firstChild.nodeValue = newText;
              }
            } else {
              span.remove();
            }
          });
        }
        
        // Restore caret to the end of the new text
        if (selection) {
          const caretRange = document.createRange();
          caretRange.selectNodeContents(element);
          caretRange.collapse(false);
          selection.removeAllRanges();
          selection.addRange(caretRange);
        }
        
        // Trigger comprehensive events
        ['beforeinput', 'input', 'keyup', 'change'].forEach(eventType => {
          try {
            if (eventType === 'input' || eventType === 'beforeinput') {
              const inputEvent = new InputEvent(eventType, {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: newText
              });
              element.dispatchEvent(inputEvent);
            } else {
              const event = new Event(eventType, { bubbles: true, cancelable: true });
              element.dispatchEvent(event);
            }
          } catch (e) {
            const event = new Event(eventType, { bubbles: true, cancelable: true });
            element.dispatchEvent(event);
          }
        });
        
        // Final safeguard: ensure editability before returning
        if (wasContentEditable === 'true') {
          element.contentEditable = 'true';
          element.setAttribute('contenteditable', 'true');
        }
        element.removeAttribute('readonly');
        element.removeAttribute('disabled');
        
        setCaretToEnd(element);
      }
      
      // Method 3: Verification and fallback (after both Method 2 attempts)
      setTimeout(() => {
        const verifyText = getTextContent(element);
        if (verifyText.trim() !== newText.trim() && !verifyText.includes(newText.substring(0, 15))) {
          console.log("Method 2 failed, attempting final fallback with events");
          element.textContent = newText;
          
          // Ensure editability is maintained in fallback
          if (wasContentEditable === 'true') {
            element.contentEditable = 'true';
            element.setAttribute('contenteditable', 'true');
          }
          element.removeAttribute('readonly');
          element.removeAttribute('disabled');
          
          // Dispatch comprehensive events
          ['input', 'change', 'keyup'].forEach(eventType => {
            const event = new Event(eventType, { bubbles: true, cancelable: true });
            element.dispatchEvent(event);
          });
          
          setCaretToEnd(element);
        }
        
        // Final verification: ensure element is still editable
        const isStillEditable = element.contentEditable === 'true' || 
                                element.getAttribute('role') === 'textbox' ||
                                element.tagName === 'TEXTAREA';
        
        if (!isStillEditable && wasContentEditable === 'true') {
          console.warn("⚠️ Element lost editability, restoring...");
          element.contentEditable = 'true';
          element.setAttribute('contenteditable', 'true');
          if (originalRole) {
            element.setAttribute('role', originalRole);
          }
        }
      }, 100);
      
      // Final safeguard: ensure editability before returning
      if (wasContentEditable === 'true') {
        element.contentEditable = 'true';
        element.setAttribute('contenteditable', 'true');
      }
      element.removeAttribute('readonly');
      element.removeAttribute('disabled');
      
      setCaretToEnd(element);
      return true;
    } else {
      // Fallback
      element.textContent = newText;
      // Ensure editability in fallback
      if (wasContentEditable === 'true') {
        element.contentEditable = 'true';
        element.setAttribute('contenteditable', 'true');
      }
      element.removeAttribute('readonly');
      element.removeAttribute('disabled');
      const event = new Event('input', { bubbles: true });
      element.dispatchEvent(event);
      setCaretToEnd(element);
      return true;
    }
  } catch (error) {
    console.error("Error replacing text:", error);
    // Even on error, try to restore editability
    if (wasContentEditable === 'true') {
      element.contentEditable = 'true';
      element.setAttribute('contenteditable', 'true');
    }
    element.removeAttribute('readonly');
    element.removeAttribute('disabled');
    return false;
  }
}

/**
 * Show a "Good job!" success tooltip after rephrasing
 */
function showSuccessTooltip(element) {
  // Remove any existing tooltip first
  const existingTooltip = document.querySelector(".escalation-tooltip");
  if (existingTooltip) {
    existingTooltip.remove();
  }
  
  // Array of encouraging messages - randomly selected each time (without "Good job!" prefix)
  const encouragingMessages = [
    "You're contributing to more respectful dialogue.",
    "You're taking steps toward more peaceful conversations.",
    "You're helping build more constructive conversations, one message at a time.",
    "You're making conversations more peaceful, one message at a time.",
    "Every thoughtful word helps build a more understanding world.",
    "You're creating space for more meaningful dialogue.",
    "Your words are making a positive difference."
  ];
  
  // Randomly select a message
  const randomMessage = encouragingMessages[Math.floor(Math.random() * encouragingMessages.length)];
  
  const successTooltip = document.createElement("div");
  successTooltip.className = "escalation-tooltip success-tooltip";
  successTooltip.innerHTML = `
    <div class="tooltip-container">
      <div class="tooltip-content success-content">
        <div class="success-icon">
          <svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 6l2 2 6-6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="success-message-wrapper">
          <p class="success-title">Good job!</p>
          <p class="success-description">${randomMessage}</p>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(successTooltip);
  
  // Position tooltip near the element
  if (element) {
    const rect = element.getBoundingClientRect();
    const tooltipRect = successTooltip.getBoundingClientRect();
    
    // Position below the element with some spacing
    let top = rect.bottom + window.scrollY + 10;
    let left = rect.left + window.scrollX;
    
    // Ensure tooltip doesn't go off-screen
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Adjust horizontal position if tooltip goes off right edge
    if (left + tooltipRect.width > viewportWidth) {
      left = viewportWidth - tooltipRect.width - 20;
    }
    
    // If tooltip goes below viewport, position it above the element instead
    if (top + tooltipRect.height > viewportHeight + window.scrollY) {
      top = rect.top + window.scrollY - tooltipRect.height - 10;
    }
    
    // Ensure minimum left position
    if (left < 10) {
      left = 10;
    }
    
    successTooltip.style.top = `${top}px`;
    successTooltip.style.left = `${left}px`;
  }
  
  // Auto-dismiss after 2.5 seconds
  setTimeout(() => {
    if (successTooltip && successTooltip.parentNode) {
      successTooltip.style.opacity = '0';
      successTooltip.style.transition = 'opacity 0.3s ease-out';
      setTimeout(() => {
        successTooltip.remove();
      }, 300);
    }
  }, 2500);
}

async function createEscalationTooltip(originalText, element, escalationType = 'unknown') {
  // Remove if already shown
  const existing = document.querySelector(".escalation-tooltip");
  if (existing) existing.remove();

  // Detect if text is in Hebrew for UI localization
  const isHebrew = containsHebrew(originalText);
  
  // Hebrew UI text
  const uiText = isHebrew ? {
    warning: "לתגובה/פוסט שכתבת, יש סיכוי גבוה להסלים את השיח.",
    suggestLabel: "אופציה מעודנת לשקילה:",
    dismiss: "בטל",
    rephrase: "נסח מחדש",
    generating: "מייצר הצעה..."
  } : {
    warning: "This comment/post has a high chance of escalating the conversation.",
    suggestLabel: "Consider rephrasing:",
    dismiss: "Dismiss",
    rephrase: "Rephrase",
    generating: "⏳ Generating rephrasing suggestion..."
  };

  // Store the element reference - use the one passed in, or try to find it
  let targetElement = element;
  
  // If no element passed, try to find the active/focused element
  if (!targetElement) {
    targetElement = document.activeElement;
    
    // If active element is not editable, try to find the most recent editable element
    if (!targetElement || 
        (targetElement.contentEditable !== 'true' && 
         targetElement.tagName !== 'TEXTAREA' && 
         targetElement.getAttribute('role') !== 'textbox')) {
      const allEditable = document.querySelectorAll('[contenteditable="true"], textarea, [role="textbox"]');
      if (allEditable.length > 0) {
        // Find the one that contains the original text or is focused
        for (let el of allEditable) {
          const elText = getTextContent(el);
          if (elText === originalText || elText.includes(originalText.substring(0, 20))) {
            targetElement = el;
            break;
          }
        }
        // If no match, use the last one
        if (!targetElement || targetElement.contentEditable !== 'true') {
          targetElement = allEditable[allEditable.length - 1];
        }
      }
    }
  }
  
  console.log("🎯 Target element for rephrasing:", {
    tag: targetElement?.tagName,
    contenteditable: targetElement?.contentEditable,
    role: targetElement?.getAttribute('role'),
    currentText: targetElement ? getTextContent(targetElement).substring(0, 50) : 'none'
  });
  
  // Show tooltip with loading state first
  const tooltip = document.createElement("div");
  tooltip.className = `escalation-tooltip ${isHebrew ? 'hebrew-tooltip' : ''}`;
  tooltip.innerHTML = `
    <div class="tooltip-container">
      <div class="tooltip-content ${isHebrew ? 'rtl-content' : ''}">
        <p class="tooltip-message ${isHebrew ? 'rtl-text' : ''}">${uiText.warning}</p>
        <div class="tooltip-suggestion ${isHebrew ? 'rtl-suggestion' : ''}" style="display: none;">
          <p class="tooltip-suggestion-label ${isHebrew ? 'rtl-text' : ''}">${uiText.suggestLabel}</p>
          <p class="tooltip-suggestion-text ${isHebrew ? 'rtl-text' : ''}"></p>
        </div>
        <div class="tooltip-buttons ${isHebrew ? 'rtl-buttons' : ''}">
          <button id="dismissBtn" class="tooltip-btn dismiss-btn">${uiText.dismiss}</button>
          <button id="rephraseBtn" class="tooltip-btn rephrase-btn loading" disabled>
            <span class="spinner"></span>
            ${uiText.rephrase}
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(tooltip);
  
  // Function to update tooltip position based on target element
  const updateTooltipPosition = () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/129f1d44-820f-4581-af24-9711702125a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:1847',message:'updateTooltipPosition called',data:{hasTargetElement:!!targetElement,hasTooltip:!!tooltip,tooltipInDOM:tooltip?.parentNode?true:false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (!targetElement || !tooltip.parentNode) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/129f1d44-820f-4581-af24-9711702125a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:1850',message:'Early return in updateTooltipPosition',data:{hasTargetElement:!!targetElement,hasTooltip:!!tooltip,tooltipInDOM:tooltip?.parentNode?true:false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return;
    }
    
    const rect = targetElement.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    // Position below the element with some spacing (using viewport coordinates for fixed positioning)
    let top = rect.bottom + 10;
    let left = rect.left;
    
    // Ensure tooltip doesn't go off-screen
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Adjust horizontal position if tooltip goes off right edge
    if (left + tooltipRect.width > viewportWidth) {
      left = viewportWidth - tooltipRect.width - 20;
    }
    
    // If tooltip goes below viewport, position it above the element instead
    if (top + tooltipRect.height > viewportHeight) {
      top = rect.top - tooltipRect.height - 10;
    }
    
    // Ensure minimum positions
    if (left < 10) {
      left = 10;
    }
    if (top < 10) {
      top = 10;
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/129f1d44-820f-4581-af24-9711702125a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:1880',message:'Setting tooltip position',data:{top,left,rectTop:rect.top,rectBottom:rect.bottom,rectLeft:rect.left,scrollY:window.scrollY},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  };
  
  // Position tooltip initially
  updateTooltipPosition();
  
  // Update position on scroll and resize to keep it attached to the element
  const positionUpdateHandler = () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/129f1d44-820f-4581-af24-9711702125a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:1887',message:'Scroll/resize handler fired',data:{scrollY:window.scrollY,scrollX:window.scrollX},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    updateTooltipPosition();
  };
  
  // Use passive listeners for better scroll performance
  window.addEventListener('scroll', positionUpdateHandler, { passive: true, capture: true });
  window.addEventListener('resize', positionUpdateHandler, { passive: true });
  
  // Also listen for scroll on document (in case scroll happens on document element)
  document.addEventListener('scroll', positionUpdateHandler, { passive: true, capture: true });
  
  // Listen for scroll on document.documentElement as well (some browsers)
  if (document.documentElement) {
    document.documentElement.addEventListener('scroll', positionUpdateHandler, { passive: true, capture: true });
  }
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/129f1d44-820f-4581-af24-9711702125a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:1893',message:'Event listeners added',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  // Store cleanup function on tooltip element for later cleanup
  tooltip._cleanupPositionHandlers = () => {
    window.removeEventListener('scroll', positionUpdateHandler, { capture: true });
    window.removeEventListener('resize', positionUpdateHandler);
    document.removeEventListener('scroll', positionUpdateHandler, { capture: true });
    if (document.documentElement) {
      document.documentElement.removeEventListener('scroll', positionUpdateHandler, { capture: true });
    }
  };
  
  // Override remove method to clean up listeners
  const originalRemove = tooltip.remove.bind(tooltip);
  tooltip.remove = function() {
    if (tooltip._cleanupPositionHandlers) {
      tooltip._cleanupPositionHandlers();
    }
    originalRemove();
  };

  // Generate rephrased version (async - may call API)
  let rephrasedText;
  try {
    rephrasedText = await rephraseForDeEscalation(originalText);
  } catch (error) {
    console.error('❌ Error during rephrasing:', error);
    // Fallback to pattern matching on error
    rephrasedText = await rephraseForDeEscalation(originalText);
  }
  
  // Update tooltip with the rephrased text
  const suggestionContainer = tooltip.querySelector('.tooltip-suggestion');
  const suggestionText = tooltip.querySelector('.tooltip-suggestion-text');
  const rephraseBtn = tooltip.querySelector('#rephraseBtn') || document.getElementById('rephraseBtn');
  if (suggestionText && rephrasedText) {
    // Show the suggestion container now that we have the rephrased text
    if (suggestionContainer) {
      suggestionContainer.style.display = 'block';
    }
    // FINAL cleanup for Hebrew - remove any English that might have slipped through
    let finalText = rephrasedText;
    if (isHebrew || containsHebrew(rephrasedText)) {
      // Find first Hebrew character and remove everything before it
      const firstHebrewPos = finalText.search(/[\u0590-\u05FF]/);
      if (firstHebrewPos >= 0 && firstHebrewPos > 0) {
        console.log(`🧹 FINAL CLEANUP: Removing ${firstHebrewPos} chars before Hebrew`);
        finalText = finalText.substring(firstHebrewPos);
      }
      
      // Remove any remaining English at the start
      finalText = finalText.replace(/^[A-Za-z\s,.:;!?-]+/, '').trim();
      
      // Remove common English phrases
      finalText = finalText.replace(/^(In my view|I see|I think|I feel|I believe|From my perspective|In my opinion)[,\s.:;!?-]*/i, '').trim();
      
      // Remove any standalone English words
      finalText = finalText.replace(/\b[A-Za-z]{2,}\b/g, '').replace(/\s+/g, ' ').trim();
      
      console.log('🧹 FINAL TEXT AFTER CLEANUP:', finalText);
      
      // Ensure RTL class is applied
      suggestionText.classList.add('rtl-text');
    }
    
    suggestionText.textContent = `"${finalText}"`;
    if (rephraseBtn) {
      rephraseBtn.disabled = false;
      rephraseBtn.classList.remove('loading');
      const spinner = rephraseBtn.querySelector('.spinner');
      if (spinner) spinner.remove();
    }
  } else {
    // If rephrasing failed, show fallback
    const errorMsg = isHebrew 
      ? '"שגיאה ביצירת ניסוח מחדש. אנא נסה שוב."'
      : '"Error generating rephrasing. Please try again."';
    if (suggestionText) {
      if (isHebrew) {
        suggestionText.classList.add('rtl-text');
      }
      suggestionText.textContent = errorMsg;
    }
    if (rephraseBtn) {
      rephraseBtn.disabled = true;
      rephraseBtn.classList.remove('loading');
      const spinner = rephraseBtn.querySelector('.spinner');
      if (spinner) spinner.remove();
    }
  }

  // Add event listeners for buttons - ensure they're always accessible
  // Use tooltip.querySelector instead of document.getElementById to ensure we get the button from THIS tooltip
  const dismissBtn = tooltip.querySelector("#dismissBtn");
  const rephraseBtnElement = tooltip.querySelector("#rephraseBtn");
  
  if (!dismissBtn || !rephraseBtnElement) {
    console.error("❌ Buttons not found in tooltip!");
    return;
  }
  
  // Use addEventListener for better compatibility and event handling
  dismissBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Log that user dismissed the suggestion
    logInteraction({
      usersOriginalContent: originalText,
      rephraseSuggestion: rephrasedText,
      didUserAccept: 'no',
      escalationType
    });
    
    if (tooltip && tooltip.parentNode) {
      tooltip.remove();
    }
  }, { once: true });

  rephraseBtnElement.onclick = () => {
    console.log("🔄 Rephrasing text...");
    console.log("Original:", originalText);
    console.log("Rephrased:", rephrasedText);
    
    // Store element reference and editability state BEFORE any changes
    const elementToRephrase = targetElement;
    if (!elementToRephrase) {
      console.error("❌ No target element found for rephrasing");
      tooltip.remove();
      return;
    }
    
    // Preserve original editability state
    const originalContentEditable = elementToRephrase.contentEditable;
    const originalRole = elementToRephrase.getAttribute('role');
    
    // Set flag to prevent immediate re-detection
    justRephrased = true;
    
    // Clear any existing timeout
    if (rephraseTimeout) {
      clearTimeout(rephraseTimeout);
    }
    
    // Remove original tooltip immediately
    tooltip.remove();
    
    console.log("🔄 About to replace text in element:", {
      elementTag: elementToRephrase.tagName,
      elementContentEditable: elementToRephrase.contentEditable,
      currentText: getTextContent(elementToRephrase).substring(0, 50),
      newText: rephrasedText.substring(0, 50)
    });
    
    const success = replaceTextInElement(elementToRephrase, rephrasedText);
    
    console.log("🔄 replaceTextInElement returned:", success);
    
    // IMMEDIATELY ensure editability - don't wait
    function forceEditability() {
      if (!elementToRephrase) return;
      
      // Force contentEditable
      if (elementToRephrase.tagName !== 'TEXTAREA') {
        elementToRephrase.contentEditable = 'true';
        elementToRephrase.setAttribute('contenteditable', 'true');
      }
      
      // Restore role if it existed
      if (originalRole) {
        elementToRephrase.setAttribute('role', originalRole);
      }
      
      // Remove blocking attributes
      elementToRephrase.removeAttribute('readonly');
      elementToRephrase.removeAttribute('disabled');
      
      // Ensure it's focusable
      if (elementToRephrase.tabIndex === -1) {
        elementToRephrase.tabIndex = 0;
      }
    }
    
    // Apply immediately and multiple times to be sure
    forceEditability();
    
    if (success) {
      // Verify the text was actually replaced and re-enable editing
      setTimeout(() => {
        const verifyText = getTextContent(elementToRephrase);
        const wasReplaced = verifyText.trim() === rephrasedText.trim() || 
                           verifyText.includes(rephrasedText.substring(0, 15));
        
        if (wasReplaced) {
          console.log("✅ Text successfully rephrased! New text:", verifyText);
          
          // Log that user accepted the suggestion
          logInteraction({
            usersOriginalContent: originalText,
            rephraseSuggestion: rephrasedText,
            didUserAccept: 'yes',
            escalationType
          });
          
          // Show "Good job!" tooltip
          showSuccessTooltip(elementToRephrase);
          
          // Force editability again after text replacement
          forceEditability();
          
          // Ensure editability and focus for immediate editing - use multiple timeouts
          // to combat platform interference
          setTimeout(() => {
            forceEditability();
            
            // Focus the element aggressively
            elementToRephrase.focus({ preventScroll: true });
            
            // Use requestAnimationFrame for better timing
            requestAnimationFrame(() => {
              forceEditability();
              elementToRephrase.focus({ preventScroll: true });
              
              // Place cursor at end
              const selection = window.getSelection();
              if (selection) {
                const range = document.createRange();
                try {
                  // Try to find a text node
                  let textNode = elementToRephrase.firstChild;
                  
                  // If no direct text node, find one in the content
                  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
                    const walker = document.createTreeWalker(
                      elementToRephrase,
                      NodeFilter.SHOW_TEXT,
                      null
                    );
                    textNode = walker.nextNode();
                  }
                  
                  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                    const len = textNode.textContent?.length || 0;
                    range.setStart(textNode, len);
                    range.setEnd(textNode, len);
                  } else {
                    // Fallback: select all and collapse to end
                    range.selectNodeContents(elementToRephrase);
                    range.collapse(false);
                  }
                  
                  selection.removeAllRanges();
                  selection.addRange(range);
                  
                  // Verify we can still type
                  console.log("✅ Element ready for editing:", {
                    contentEditable: elementToRephrase.contentEditable,
                    role: elementToRephrase.getAttribute('role'),
                    hasSelection: selection.rangeCount > 0,
                    isContentEditable: elementToRephrase.isContentEditable
                  });
                } catch (e) {
                  console.warn("Could not set cursor:", e);
                  // At minimum, ensure focus
                  forceEditability();
                  elementToRephrase.focus({ preventScroll: true });
                }
              } else {
                // Fallback: just focus
                forceEditability();
                elementToRephrase.focus({ preventScroll: true });
              }
              
              // Final check - ensure it's still editable after a brief moment
              setTimeout(() => {
                forceEditability();
                if (document.activeElement !== elementToRephrase) {
                  elementToRephrase.focus({ preventScroll: true });
                }
              }, 50);
            });
          }, 50);
          
          // Also check after a longer delay to catch platform re-initialization
          setTimeout(() => {
            forceEditability();
            if (document.activeElement !== elementToRephrase && elementToRephrase.isConnected) {
              elementToRephrase.focus({ preventScroll: true });
            }
          }, 300);
          
          // Set up a watchdog to continuously ensure editability for 3 seconds
          // This catches cases where the platform re-initializes the editor
          let editabilityWatchdogCount = 0;
          const maxWatchdogChecks = 30; // 3 seconds at 100ms intervals
          const editabilityWatchdog = setInterval(() => {
            if (!elementToRephrase || !elementToRephrase.isConnected) {
              clearInterval(editabilityWatchdog);
              return;
            }
            
            editabilityWatchdogCount++;
            
            // Check if element is still editable
            const isCurrentlyEditable = elementToRephrase.contentEditable === 'true' || 
                                       elementToRephrase.getAttribute('role') === 'textbox' ||
                                       elementToRephrase.tagName === 'TEXTAREA';
            
            if (!isCurrentlyEditable) {
              console.log("⚠️ Watchdog detected lost editability, restoring...");
              forceEditability();
            }
            
            // Check for readonly/disabled attributes
            if (elementToRephrase.hasAttribute('readonly') || elementToRephrase.hasAttribute('disabled')) {
              elementToRephrase.removeAttribute('readonly');
              elementToRephrase.removeAttribute('disabled');
            }
            
            // Stop after max checks
            if (editabilityWatchdogCount >= maxWatchdogChecks) {
              clearInterval(editabilityWatchdog);
              console.log("✅ Editability watchdog completed");
            }
          }, 100);
        } else {
          console.error("❌ Text replacement failed! Expected:", rephrasedText, "Got:", verifyText);
          justRephrased = false; // Reset flag if replacement failed
        }
        
        // Reset flag after 2 seconds to allow future checks (only if replacement succeeded)
        if (wasReplaced) {
          rephraseTimeout = setTimeout(() => {
            justRephrased = false;
            console.log("🔄 Re-enabled escalation detection");
          }, 2000);
        }
      }, 100); // Reduced timeout for faster response
    } else {
      console.error("❌ Failed to replace text");
      justRephrased = false; // Reset if failed
    }
  };
}

// Debounce function to prevent too many checks
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Attach listeners to a contenteditable element
function attachListeners(element) {
  if (!element || element.dataset.escalationListenerAttached) {
    return;
  }

  // Debounced check function
  const debouncedCheck = debounce(() => {
    checkForEscalation(element);
  }, 300);

  // Listen to multiple events for better compatibility
  // NOTE: We don't listen to keydown to avoid interfering with delete/backspace operations
  element.addEventListener("input", debouncedCheck, { passive: true });
  element.addEventListener("keyup", debouncedCheck, { passive: true });
  element.addEventListener("paste", () => {
    setTimeout(debouncedCheck, 100); // Wait for paste to complete
  }, { passive: true });
  element.addEventListener("compositionend", debouncedCheck, { passive: true }); // For IME input
  
  // For textareas, also listen to change event
  if (element.tagName === 'TEXTAREA') {
    element.addEventListener("change", debouncedCheck);
  }

  element.dataset.escalationListenerAttached = "true";
  console.log("✅ Attached escalation listeners to element", {
    tag: element.tagName,
    contenteditable: element.contentEditable,
    role: element.getAttribute('role'),
    ariaLabel: element.getAttribute('aria-label')?.substring(0, 50),
    className: element.className?.substring(0, 50),
    currentText: getTextContent(element).substring(0, 30)
  });
  
  // Immediate check for existing text
  const existingText = getTextContent(element);
  if (existingText && existingText.length > 10) {
    console.log("🔍 Checking existing text immediately:", existingText.substring(0, 50));
    checkForEscalation(element);
  }
}

// Find all potential text input elements (contenteditable, textareas, role="textbox")
function findAllEditableElements() {
  const elements = [];
  
  // 1. Contenteditable elements
  const contenteditables = document.querySelectorAll('[contenteditable="true"]');
  elements.push(...Array.from(contenteditables));
  
  // 2. Textareas (Facebook sometimes uses these)
  const textareas = document.querySelectorAll('textarea');
  elements.push(...Array.from(textareas));
  
  // 3. Elements with role="textbox" (Facebook's post composer often uses this)
  const roleTextboxes = document.querySelectorAll('[role="textbox"]');
  elements.push(...Array.from(roleTextboxes));
  
  // 4. Facebook-specific: divs with data-lexical-editor or similar
  const facebookEditors = document.querySelectorAll('div[data-lexical-editor="true"], div[data-testid*="post"], div[aria-label*="post"], div[aria-label*="Post"], div[aria-label*="What\'s on your mind"]');
  elements.push(...Array.from(facebookEditors));
  
  // Remove duplicates
  return [...new Set(elements)];
}

// Wait for DOM to be ready
function initializeObserver() {
  if (!document.body) {
    // If body doesn't exist yet, wait for it
    setTimeout(initializeObserver, 100);
    return;
  }

  console.log("🔍 Initializing escalation detector...");
  console.log("✅ Extension loaded successfully");
  console.log("⚙️ USE_API:", typeof USE_API !== 'undefined' ? USE_API : 'undefined');
  console.log("⚙️ API_CONFIG.model:", typeof API_CONFIG !== 'undefined' ? API_CONFIG.model : 'undefined');

  // MutationObserver for dynamic content (like Facebook's post composer)
  const observer = new MutationObserver(() => {
    const allEditable = findAllEditableElements();
    allEditable.forEach(attachListeners);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["contenteditable", "role", "aria-label"]
  });

  // Also check for existing editable elements immediately
  const existingEditable = findAllEditableElements();
  console.log(`Found ${existingEditable.length} existing editable elements (contenteditable, textarea, role="textbox", etc.)`);
  existingEditable.forEach(attachListeners);

  // Periodically check for new elements (Facebook sometimes creates them dynamically)
  setInterval(() => {
    const allEditable = findAllEditableElements();
    allEditable.forEach(attachListeners);
  }, 2000);
}

// Start initialization
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeObserver);
} else {
  initializeObserver();
}