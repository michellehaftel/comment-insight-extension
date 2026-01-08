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

// Store the last logged interaction so we can update it with actual posted text
let lastLoggedInteraction = null;
let pendingInteractionElement = null;

/**
 * Monitor post button clicks to capture actual posted text
 */
function setupPostButtonMonitoring() {
  // Only run on Twitter/X for now (can be extended to other platforms)
  if (!isTwitter()) return;
  
  // Twitter/X post button selectors
  const postButtonSelectors = [
    '[data-testid="tweetButton"]',
    '[data-testid="tweetButtonInline"]',
    'button[type="button"][data-testid*="tweet"]',
    'div[role="button"][data-testid*="tweet"]',
    'div[data-testid="tweetButton"]'
  ];
  
  // Monitor clicks on post buttons (use capture phase to catch event early)
  document.addEventListener('click', (e) => {
    // Check if clicked element or parent is a post button
    let target = e.target;
    let isPostButton = false;
    
    // Check element and parents up to 4 levels
    for (let i = 0; i < 5 && target; i++) {
      for (const selector of postButtonSelectors) {
        try {
          if (target.matches && target.matches(selector)) {
            isPostButton = true;
            break;
          }
        } catch (err) {
          // Ignore selector errors
        }
      }
      if (isPostButton) break;
      target = target.parentElement;
    }
    
    if (isPostButton) {
      console.log('📮 Post button clicked! Capturing final text...');
      
      // Find the active textarea/composer
      const composer = document.querySelector('[data-testid="tweetTextarea_0"]');
      if (composer) {
        const finalText = getTextContent(composer);
        console.log('📝 Final posted text:', finalText);
        
        // If we have a pending interaction, update it with actual posted text
        if (lastLoggedInteraction) {
          const updatedData = {
            ...lastLoggedInteraction,
            actualPostedText: finalText || ''
          };
          
          // Re-log with actual posted text
          logInteraction(updatedData);
          
          // Clear the stored interaction after logging
          lastLoggedInteraction = null;
          pendingInteractionElement = null;
        } else {
          // Log standalone post (no escalation detected earlier)
          logInteraction({
            usersOriginalContent: finalText || '',
            rephraseSuggestion: '',
            didUserAccept: 'not_applicable',
            escalationType: 'none',
            actualPostedText: finalText || ''
          });
        }
      }
    }
  }, true); // Use capture phase to catch event early
  
  console.log('✅ Post button monitoring initialized');
}

/**
 * Log interaction data to background script for Google Sheets
 */
async function logInteraction(data) {
  try {
    const postContext = getPostContext();
    
    // Store for potential update when post button is clicked (only if not already containing actualPostedText)
    if (!data.actualPostedText) {
      lastLoggedInteraction = {
        usersOriginalContent: data.usersOriginalContent || '',
        rephraseSuggestion: data.rephraseSuggestion || '',
        didUserAccept: data.didUserAccept || 'no',
        escalationType: data.escalationType || 'unknown'
      };
      
      // Try to find and store the element reference
      const composer = document.querySelector('[data-testid="tweetTextarea_0"]');
      if (composer) {
        pendingInteractionElement = composer;
      }
    }
    
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
      actual_posted_text: data.actualPostedText || '', // NEW FIELD
      escalation_type: data.escalationType || 'unknown',
      platform: detectPlatformName(),
      context: window.location.href,
      post_type: postContext.isReply ? 'reply' : 'new_post'
    };
    
    console.log('📊 Logging interaction:', logData);
    console.log(`📝 Post type: ${postContext.isReply ? 'Reply' : 'New Post'}`);
    if (data.actualPostedText) {
      console.log(`✅ Actual posted text: "${data.actualPostedText}"`);
    }
    
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
    "i can't believe", // Dismissive/judging
    "this is insane",
    "shut up",
    "this makes me sick",
    "worst",
    "worst mistake",
    "worst thing",
    "stupid",
    "dumb",
    "idiot",
    "moron",
    "ass",
    "asshole",
    "hate",
    "disgusting",
    "disgusting creature",
    "ridiculous",
    "brainwashed",
    "never work",
    "will never",
    "anyone who supports",
    "everything that is bad",
    "everything that is wrong",
    "what a stupid",
    "what a disgusting",
    "what a terrible",
    "once", // Catch "once X, always X" patterns
    "always an", // Part of "always an asshole" pattern
    "forever"
  ];
  
  // Profanity/cursing detection - high risk keywords
  const profanityKeywords = [
    "fuck", "fucking", "fucked", "fucker", "fucks",
    "shit", "shitting", "shitted", "shits", "shitty",
    "damn", "damned", "damnit", "dammit",
    "hell", "hellish",
    "bitch", "bitches", "bitching",
    "bastard", "bastards",
    "crap", "crappy",
    "piss", "pissed", "pissing",
    "cunt", "cunts",
    "dick", "dicks", "dickhead",
    "prick", "pricks",
    "cock", "cocks",
    "asshole", "assholes",
    "bitch", "bitches",
    "motherfucker", "motherfuckers", "motherfucking",
    "son of a bitch", "sob",
    "goddamn", "goddamnit",
    "bloody hell",
    "bullshit", "bullshit",
    "crap",
    "piss off",
    "screw you", "screw off",
    "f off", // Euphemism
    "screw",
    "piss",
    "damn you",
    "go to hell"
  ];
  
  // Check for profanity - these are always high risk
  // Use word boundaries to avoid false positives (e.g., "cockroach" matching "cock", "dismiss" matching "miss")
  // For multi-word phrases like "son of a bitch", use phrase matching with word boundaries at start/end
  const profanityPatterns = profanityKeywords.map(kw => {
    // Multi-word phrases need special handling (word boundaries only at start and end)
    if (kw.includes(' ')) {
      // For phrases, escape special regex chars and match as phrase with word boundaries
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i');
    } else {
      // Single words use word boundaries on both sides
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i');
    }
  });
  
  if (profanityPatterns.some(pattern => pattern.test(text))) {
    return true;
  }
  
  // Check regular keywords with word boundaries to avoid false positives
  const keywordPatterns = keywordList.map(kw => {
    // Multi-word phrases
    if (kw.includes(' ')) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i');
    } else {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i');
    }
  });
  
  return keywordPatterns.some(pattern => pattern.test(text));
}

/**
 * Detect if text contains Hebrew characters
 * DISABLED: Hebrew support is currently deactivated
 */
function containsHebrew(text) {
  // Hebrew Unicode range: \u0590-\u05FF
  // DISABLED: Always return false to disable Hebrew support
  return false;
  // return /[\u0590-\u05FF]/.test(text);
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

  // DISABLED: Hebrew support is currently deactivated
  // If text contains Hebrew or other non-Latin characters, and API is enabled,
  // we should use API-based detection (but for now, allow it through for API check)
  const hasNonLatin = containsNonLatin(trimmedText);
  const hasHebrew = false; // DISABLED: containsHebrew(trimmedText);
  
  // DISABLED: Hebrew special handling
  // For non-English text (especially Hebrew), we rely on API for detection
  // So we return a moderate escalation score to trigger API check
  if (false && (hasHebrew || (hasNonLatin && USE_API))) {
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
    /\b(always|never|everyone|nobody|nothing|everything|neither|either)\b/i,
    /\b(only|solely|exclusively|completely|totally|absolutely|definitely|certainly|just|actually)\b/i
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

  // 3.5. Dismissive/categorical statements about relationships or third parties
  // These catch dismissive language about political relationships, partnerships, etc.
  const dismissiveRelationshipPatterns = [
    /\bis just (?:a|an) (?:political theater|show|act|game|joke|charade)\b/i, // "is just political theater"
    /\bis (?:nothing but|only|merely|simply) (?:a|an) (?:political theater|show|act|game|joke|charade)\b/i,
    /\b(?:neither|either) (?:actually|really|truly|genuinely) (?:care|cares|care about|matter|matters)\b/i, // "Neither actually care"
    /\b(?:they|he|she) (?:don't|doesn't) (?:actually|really|truly|genuinely) (?:care|matter|mean it)\b/i,
    /\b(?:their|his|her) (?:relationship|friendship|alliance) is (?:just|only|merely|simply|nothing but)\b/i // "their relationship is just..."
  ];
  
  dismissiveRelationshipPatterns.forEach(pattern => {
    if (pattern.test(trimmedText)) {
      escalationScore += 2;
      reasons.push("Dismissive/categorical statement about relationships or third parties");
    }
  });

  // 4. Judging/condemning language
  const judgingPatterns = [
    // Basic "you are/you're [negative adjective]"
    /\b(you're (?:terrible|awful|horrible|disgusting|pathetic|ridiculous|stupid|dumb|an idiot|a moron|an ass|an asshole))\b/i,
    /\b(you are such a (?:dumb (?:ass|asshole)|idiot|moron|jerk|fool|terrible|awful|horrible|disgusting|pathetic|ridiculous|stupid))\b/i, // "you are such a dumb ass", "you are such a idiot", etc.
    /\b(you are (?:so |such )?(?:terrible|awful|horrible|disgusting|pathetic|ridiculous|stupid|dumb(?:ass| ass)?|idiot|moron|ass(?:hole)?|jerk|fool))\b/i, // "you are so stupid", "you are dumb", etc.
    
    // "You are [article] [adjective] [noun]" patterns (e.g., "you are a disgusting creature", "you are the worst mistake")
    /\b(you are (?:a|an|the) (?:disgusting|terrible|awful|horrible|pathetic|ridiculous|stupid|dumb|worst|bad|worst|vile|repulsive|despicable|contemptible) (?:creature|mistake|person|human|thing|being|scum|filth|waste|joke|disgrace|shame|failure|monster|beast|animal))\b/i,
    
    // Third-person statements about specific people: "[Name] is a [adjective] [noun]" (e.g., "Bibi is a disgusting creature", "Trump is a terrible person")
    /\b\w+ (?:is|are|was|were) (?:a|an|the) (?:disgusting|terrible|awful|horrible|pathetic|ridiculous|stupid|dumb|worst|bad|vile|repulsive|despicable|contemptible) (?:creature|mistake|person|human|thing|being|scum|filth|waste|joke|disgrace|shame|failure|monster|beast|animal)\b/i,
    
    // Third-person "[Name] is such a [negative noun]" patterns
    /\b\w+ (?:is|are|was|were) such a (?:mistake|failure|disgrace|shame|joke|monster|beast|animal|creature|scum|filth|waste|disaster|tragedy|nightmare|curse|plague|burden|problem|issue|threat|danger|liability)\b/i,
    
    // "You are such a [negative noun]" patterns (e.g., "you are such a mistake", "you are such a failure")
    /\b(you are such a (?:mistake|failure|disgrace|shame|joke|monster|beast|animal|creature|scum|filth|waste|disaster|tragedy|nightmare|curse|plague|burden|problem|issue|threat|danger|liability))\b/i,
    
    // "You are [a/an/the] [negative noun]" patterns without adjective (e.g., "you are a mistake", "you are the problem")
    /\b(you are (?:a|an|the) (?:mistake|failure|disgrace|shame|joke|monster|beast|animal|creature|scum|filth|waste|disaster|tragedy|nightmare|curse|plague|burden|problem|issue|threat|danger|liability|embarrassment|disappointment|fraud|fake|imposter|hypocrite|coward|traitor|enemy|foe|opponent|adversary|villain|criminal|evil|poison|disease|cancer|virus|pest|parasite|leech|freeloader))\b/i,
    
    // "You are everything that is [negative]"
    /\b(you are everything (?:that is|which is) (?:bad|wrong|evil|terrible|awful|horrible|disgusting|pathetic|ridiculous|stupid|wrong with|terrible about))\b/i,
    
    // "You are [the/your/a] worst [noun]" patterns
    /\b(you are (?:the|your|a) worst (?:mistake|thing|person|human|decision|choice|example|representation|embodiment|excuse|reason|excuse|excuse for|joke|disgrace|shame|failure))\b/i,
    
    // "What a [adjective] [noun]" condescending patterns
    /\b(what a (?:stupid|disgusting|terrible|awful|horrible|pathetic|ridiculous|dumb|idiotic|vile|repulsive|despicable|contemptible) (?:human|person|creature|thing|joke|disgrace|shame|failure|mistake|being|monster|beast|animal|idiot|moron|fool|jerk))\b/i,
    
    // "I can't believe" dismissive/judging patterns
    /\b(i (?:can't|cannot) believe (?:you|that) (?:are|were|would|still|actually|really))\b/i,
    
    // Other judging patterns
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

  // 4.5. Profanity/cursing detection - HIGH ESCALATION RISK
  // Only flag profanity in negative/neutral contexts, NOT positive contexts
  // Based on: https://en.wiktionary.org/wiki/Category:English_swear_words
  
  // Comprehensive list of curse words from Wiktionary
  const curseWords = [
    // F-words
    'fuck', 'fucking', 'fucked', 'fucker', 'fucks',
    // S-words
    'shit', 'shitting', 'shitted', 'shits', 'shitty', 'shite',
    // D-words
    'damn', 'damned', 'damnit', 'dammit', 'goddamn', 'goddamnit', 'goddamned', 'godsdamn',
    // Other strong profanity
    'hell', 'hellish', 'bitch', 'bitches', 'bitching', 'bastard', 'bastards',
    'cunt', 'cunts', 'dick', 'dicks', 'dickhead', 'dick-head', 'prick', 'pricks',
    'cock', 'cocks', 'cocksucker', 'motherfucker', 'motherfuckers', 'motherfucking', 'mother-fucker',
    'bullshit', 'horseshit', 'piss', 'pissing', 'pissed', 'wanker', 'twat',
    'arse', 'arsehead', 'arsehole', 'arseholes', 'ass', 'asshole', 'assholes', 'arsehead',
    'bugger', 'bollocks', 'crap', 'dumb-ass', 'dumbass', 'jack-ass', 'jackass', 'jackarse',
    // Slurs and offensive terms (always escalatory)
    'fag', 'faggot', 'dyke', 'kike', 'tranny', 'slut', 'spastic',
    'nigga', 'nigra',
    // Compound curse words
    'child-fucker', 'father-fucker', 'fatherfucker', 'brotherfucker', 'sisterfuck', 'sisterfucker',
    'pigfucker'
  ];
  
  // Negative context words that make profanity escalatory
  const negativeWords = /\b(?:ridiculous|terrible|awful|horrible|stupid|idiotic|disgusting|pathetic|wrong|bad|worse|worst|hate|hated|annoying|frustrating|useless|pointless|garbage|trash|crazy|insane|dumb|absurd|nonsense|idiot|moron|jerk|fool|disgusting|hateful|offensive)\b/i;
  
  // Positive context words - profanity here is NOT escalatory
  const positiveWords = /\b(?:amazing|great|awesome|fantastic|wonderful|excellent|incredible|beautiful|good|best|love|loved|perfect|brilliant|outstanding|superb|phenomenal|marvelous|lovely|nice|sweet|cool|nice|sweet)\b/i;
  
  // Build regex patterns for profanity in negative context
  const profanityNegativePatterns = curseWords.flatMap(curse => [
    new RegExp(`\\b(?:${curse})\\s+${negativeWords.source}`, 'i'),
    new RegExp(`${negativeWords.source}\\s+(?:${curse})\\b`, 'i') // Also catch "ridiculous fucking"
  ]);
  
  // Track which curse words were already matched to avoid double-counting
  const matchedCurseWords = new Set();
  
  // Check for profanity in negative context - VERY HIGH escalation
  profanityNegativePatterns.forEach(pattern => {
    if (pattern.test(trimmedText)) {
      escalationScore += 4;
      reasons.push("Profanity in negative context detected");
      // Mark all curse words as matched since negative patterns include all curse words
      curseWords.forEach(curse => matchedCurseWords.add(curse.toLowerCase()));
    }
  });
  
  // Check if profanity is used in positive context - if so, don't flag it
  const hasPositiveProfanity = curseWords.some(curse => {
    const positivePattern = new RegExp(`\\b(?:${curse})\\s+${positiveWords.source}`, 'i');
    return positivePattern.test(trimmedText);
  });
  
  const hasNegativeProfanity = matchedCurseWords.size > 0;
  
  // Direct profanity/insults (always escalatory regardless of context)
  // BUT: Skip if already counted in negative context patterns to avoid double-counting
  const directProfanityPatterns = [
    // Direct attacks
    /\b(?:fuck (?:you|off|this|that|it|him|her|them|yourself))\b/i,
    /\b(?:fucker|fucked up)\b/i,
    /\b(?:piss (?:off|you))\b/i,
    /\b(?:screw (?:you|off))\b/i,
    /\b(?:go to hell)\b/i,
    /\b(?:damn you)\b/i,
    // Insulting terms
    /\b(?:bitch|bitches|bitching)\b/i,
    /\b(?:bastard|bastards)\b/i,
    /\b(?:cunt|cunts)\b/i,
    /\b(?:dickhead|dick-head)\b/i,
    /\b(?:motherfucker|motherfuckers|motherfucking|mother-fucker)\b/i,
    /\b(?:son of a bitch|sob)\b/i,
    /\b(?:bullshit|horseshit)\b/i,
    /\b(?:arsehole|arseholes|asshole|assholes)\b/i,
    // Slurs
    /\b(?:fag|faggot|dyke|kike|tranny|slut|spastic)\b/i,
    /\b(?:nigga|nigra)\b/i,
    // Euphemisms
    /\b(?:f off|f\*\*\*)\b/i,
    /\b(?:s\*\*\*)\b/i
  ];
  
  // Only check direct patterns if negative profanity wasn't already detected
  // This prevents double-counting: if "fucking ridiculous" matched negative pattern (+4),
  // we shouldn't also add points for the "fucking" word itself
  if (!hasNegativeProfanity) {
    directProfanityPatterns.forEach(pattern => {
      if (pattern.test(trimmedText)) {
        escalationScore += 3;
        reasons.push("Profanity/cursing detected");
        // Extract and mark matched curse words from direct patterns
        const match = trimmedText.match(pattern);
        if (match) {
          curseWords.forEach(curse => {
            if (match[0].toLowerCase().includes(curse.toLowerCase())) {
              matchedCurseWords.add(curse.toLowerCase());
            }
          });
        }
      }
    });
  }
  
  // Standalone profanity words (only if not in positive context and not already matched)
  if (!hasPositiveProfanity && !hasNegativeProfanity && matchedCurseWords.size === 0) {
    // Create regex for all standalone curse words
    const standalonePattern = new RegExp(`\\b(?:${curseWords.join('|')})\\b`, 'i');
    if (standalonePattern.test(trimmedText)) {
      escalationScore += 2.5;
      reasons.push("Profanity detected");
    }
  }

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
async function rephraseViaAPI(text, context = null) {
  try {
    // Check if API is enabled and config is available
    if (typeof USE_API === 'undefined' || !USE_API) {
      console.log('⚠️ API is disabled');
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
    
    // Get post context if not provided
    if (!context) {
      context = getPostContext();
    }
    
    // Prepare request to proxy server
    const requestBody = {
      text: text,
      context: {
        originalPostContent: context.originalPostContent || '',
        originalPostWriter: context.originalPostWriter || '',
        isReply: context.isReply || false
      },
      model: API_CONFIG.model || 'gpt-4o',
      temperature: API_CONFIG.temperature || 1.0,
      max_tokens: API_CONFIG.max_tokens || 2048,
      top_p: API_CONFIG.top_p || 1.0,
      prompt: ECPM_PROMPT // Send the full prompt template (proxy will replace {TEXT} and {CONTEXT})
    };
    
    console.log('🤖 Calling proxy server for rephrasing...');
    console.log('📡 Proxy URL:', PROXY_SERVER_URL);
    console.log('📝 Model:', requestBody.model);
    console.log('📝 Text to rephrase:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    console.log('📝 Text length:', text.length);
    console.log('📝 Context provided:', {
      hasContext: !!context,
      isReply: context?.isReply,
      hasOriginalPost: !!(context?.originalPostContent && context.originalPostContent !== 'new'),
      originalPostPreview: context?.originalPostContent?.substring(0, 50) || 'none'
    });
    console.log('📝 Parameters:', {
      temperature: requestBody.temperature,
      max_tokens: requestBody.max_tokens,
      top_p: requestBody.top_p
    });
    
    // Call proxy server with retry logic for rate limits AND transient 500 errors
    let response;
    let lastError = null;
    const maxRetries = 3; // Increased to 3 retries for better reliability
    const baseDelay = 1500; // 1.5 seconds base delay
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        // Wait before retry (exponential backoff with jitter)
        const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
        // Add random jitter (0-500ms) to avoid thundering herd
        const jitter = Math.random() * 500;
        const delay = exponentialDelay + jitter;
        console.log(`⏳ Retrying after error. Waiting ${(delay/1000).toFixed(2)}s before retry ${attempt}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      try {
        response = await fetch(`${PROXY_SERVER_URL}/api/rephrase`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        
        // If successful, break out of retry loop
        if (response.ok) {
          console.log(`✅ Request succeeded on attempt ${attempt + 1}`);
          break;
        }
        
        // Check if we should retry based on status code
        const status = response.status;
        const isRetryableError = status === 429 || (status >= 500 && status < 600);
        
        // Clone response to read it without consuming the stream
        // This allows us to read it again later if needed
        const responseClone = response.clone();
        
        // Get error details for logging (from clone, so we can read original later)
        try {
          lastError = await responseClone.json();
        } catch (e) {
          try {
            const errorText = await responseClone.text();
            lastError = { error: `HTTP ${status}`, details: errorText || response.statusText };
          } catch (textErr) {
            lastError = { error: `HTTP ${status}`, details: response.statusText };
          }
        }
        
        // If not a retryable error (like 400, 401, etc.), don't retry
        if (!isRetryableError) {
          console.error(`❌ Non-retryable error (${status}), stopping retries`);
          break;
        }
        
        // Log retry reason
        if (status === 429) {
          console.warn(`⚠️ Rate limit hit (attempt ${attempt + 1}/${maxRetries + 1})`);
        } else if (status >= 500) {
          console.warn(`⚠️ Server error ${status} (transient, attempt ${attempt + 1}/${maxRetries + 1})`);
          console.warn(`   This is often a temporary issue with Gemini's servers. Retrying...`);
        }
        
        // If this was the last attempt, don't break - let error handling below take over
        if (attempt === maxRetries) {
          console.error(`❌ All ${maxRetries + 1} attempts failed`);
        }
      } catch (networkError) {
        // Network error (connection failed, timeout, etc.) - also retry
        console.warn(`⚠️ Network error on attempt ${attempt + 1}/${maxRetries + 1}:`, networkError.message);
        lastError = { error: 'Network error', details: networkError.message };
        
        // Only retry network errors if we have attempts left
        if (attempt === maxRetries) {
          throw networkError;
        }
      }
    }
    
    // Handle case where all retries failed with network errors (response might be undefined)
    if (!response) {
      throw new Error('All retry attempts failed. Network error or server unavailable.');
    }
    
    if (!response.ok) {
      console.error('❌ API request failed with status:', response.status);
      console.error('📝 Response status text:', response.statusText);
      
      let errorData;
      // Use lastError if available (from retry loop), otherwise try to read response
      if (lastError && typeof lastError === 'object') {
        errorData = lastError;
        console.error('📄 Error data from retry loop:', JSON.stringify(errorData, null, 2));
      } else {
        // Clone response to avoid "body stream already read" error
        try {
          const responseClone = response.clone();
          const errorText = await responseClone.text();
          console.error('📄 Raw error response:', errorText);
          try {
            errorData = JSON.parse(errorText);
            console.error('📄 Parsed error response:', JSON.stringify(errorData, null, 2));
          } catch (parseErr) {
            console.error('⚠️ Error response is not JSON:', errorText);
            errorData = { error: errorText, raw: true };
          }
        } catch (textErr) {
          console.error('⚠️ Could not read error response:', textErr);
          errorData = lastError || { error: 'Unknown error', status: response.status };
        }
      }
      
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
      } else if (response.status >= 500 && response.status < 600) {
        console.error(`❌ Server error ${response.status} after ${maxRetries + 1} retry attempts`);
        console.error('📝 This is likely a temporary issue with Gemini\'s servers');
        console.error('📝 Error details:', errorData.details || errorData.error || errorData.message || JSON.stringify(errorData));
        if (errorData.debug) {
          console.error('🔍 Debug info:', errorData.debug);
        }
        console.error('💡 Tip: Wait a few seconds and try again. Server errors are usually transient.');
      } else {
        console.error('❌ Proxy server error:', response.status);
        console.error('📝 Error details:', errorData.details || errorData.error || errorData.message || JSON.stringify(errorData));
        if (errorData.stack) {
          console.error('📚 Stack trace:', errorData.stack);
        }
      }
      
      // Throw error instead of returning null - this distinguishes errors from "already de-escalatory"
      throw new Error(`API request failed: ${response.status} - ${errorData.details || errorData.error || 'Unknown error'}`);
    }
    
      const parsed = await response.json();
      
      console.log('📥 Proxy server response received');
      console.log('📄 Response keys:', Object.keys(parsed || {}));
      console.log('📄 Full response:', JSON.stringify(parsed, null, 2));
      console.log('📄 Response has rephrasedText field?', 'rephrasedText' in parsed);
      console.log('📄 rephrasedText value:', parsed?.rephrasedText);
      console.log('📄 rephrasedText type:', typeof parsed?.rephrasedText);
    
    // Log context understanding if available
    if (parsed.why?.contextUnderstanding) {
      console.log('🧠 AI Context Understanding:', {
        detectedContext: parsed.why.contextUnderstanding.detectedContext || 'Not provided',
        relationships: parsed.why.contextUnderstanding.identifiedRelationships || 'Not provided',
        contextualRelevance: parsed.why.contextUnderstanding.contextualRelevance || 'Not provided',
        contextSufficiency: parsed.why.contextUnderstanding.contextSufficiency || 'Not provided'
      });
    } else if (parsed.why?.contextConsideration) {
      console.log('📝 Context Consideration:', parsed.why.contextConsideration);
    }
    
    // Parse JSON response
    if (parsed) {
      try {
        console.log('✅ Successfully received response from proxy:', parsed);
        console.log('🔍 DEBUGGING - Response analysis:', {
          hasRephrasedTextField: 'rephrasedText' in parsed,
          rephrasedTextValue: parsed.rephrasedText,
          rephrasedTextType: typeof parsed.rephrasedText,
          isNull: parsed.rephrasedText === null,
          isUndefined: parsed.rephrasedText === undefined,
          isEmptyString: parsed.rephrasedText === '',
          allKeys: Object.keys(parsed)
        });
        
        // Extract rephrased text
        // Check if the field exists (even if null) - null means text is already de-escalatory
        if (parsed && 'rephrasedText' in parsed) {
          // If rephrasedText is null, the text is already de-escalatory
          if (parsed.rephrasedText === null) {
            console.log('ℹ️ Text is already de-escalatory, no rephrasing needed');
            console.log('⚠️ WARNING: API returned null for clearly escalatory text. This might indicate:');
            console.log('   1. The AI incorrectly classified it as de-escalatory');
            console.log('   2. The prompt needs adjustment');
            console.log('   3. The API response parsing is incorrect');
            return null;
          }
          
          // Check if it's an empty string or whitespace
          if (typeof parsed.rephrasedText === 'string' && parsed.rephrasedText.trim().length === 0) {
            console.error('❌ ERROR: rephrasedText is an empty string!');
            return null;
          }
          
          let rephrased = parsed.rephrasedText.trim();
          console.log('✅ Rephrased text extracted successfully, length:', rephrased.length);
          
          // DISABLED: Hebrew support is currently deactivated
          // If original text was Hebrew, ensure rephrased text is entirely in Hebrew
          // VERY AGGRESSIVE cleanup to remove all English
          if (false && containsHebrew(text)) {
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
            rephrasedLength: rephrased.length
            // DISABLED: Hebrew support - removed Hebrew detection from logging
            // containsHebrew: containsHebrew(rephrased),
            // originalWasHebrew: containsHebrew(text)
          });
          return rephrased;
        } else {
          // rephrasedText field doesn't exist in response - this is an error
          console.warn('⚠️ Proxy response missing rephrasedText field:', parsed);
          console.warn('📋 Response structure:', JSON.stringify(parsed, null, 2));
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
    throw error;  // Re-throw instead of returning null - this distinguishes errors from legitimate null responses
  }
}

/**
 * Rephrase text using ECPM de-escalation strategies via Gemini API.
 * No fallback - if API fails or is disabled, returns null to show error message.
 */
async function rephraseForDeEscalation(text) {
  // Only use API - no fallback to pattern matching
  if (typeof USE_API !== 'undefined' && USE_API) {
    // Get context about the post/comment being replied to
    const context = getPostContext();
    const apiResult = await rephraseViaAPI(text, context);
    return apiResult; // Return null if API fails, don't fallback
  }
  
  // If API is disabled, return null (no pattern matching fallback)
  console.log('⚠️ API is disabled');
  return null;
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
  successTooltip.className = "success-tooltip"; // Use different class to avoid conflict with escalation tooltip
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
  console.log("✅ Success tooltip created, adding to DOM");
  document.body.appendChild(successTooltip);
  console.log("✅ Success tooltip added to DOM, checking if visible:", {
    inDOM: successTooltip.parentNode !== null,
    className: successTooltip.className,
    display: window.getComputedStyle(successTooltip).display
  });
  
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
    console.log("📍 Success tooltip positioned at:", { top, left, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight });
  } else {
    console.warn("⚠️ No element provided for positioning, tooltip may not be visible");
  }
  
  console.log("⏰ Success tooltip will auto-dismiss in 2.5 seconds");
  
  // Auto-dismiss after 2.5 seconds
  setTimeout(() => {
    console.log("⏰ Auto-dismiss timeout triggered");
    if (successTooltip && successTooltip.parentNode) {
      console.log("🗑️ Fading out success tooltip");
      successTooltip.style.opacity = '0';
      successTooltip.style.transition = 'opacity 0.3s ease-out';
      setTimeout(() => {
        successTooltip.remove();
        console.log("🗑️ Success tooltip removed from DOM");
      }, 300);
    } else {
      console.warn("⚠️ Success tooltip already removed or not in DOM");
    }
  }, 2500);
}

async function createEscalationTooltip(originalText, element, escalationType = 'unknown') {
  // Remove if already shown
  const existing = document.querySelector(".escalation-tooltip");
  if (existing) existing.remove();

  // DISABLED: Hebrew support is currently deactivated
  // Detect if text is in Hebrew for UI localization
  const isHebrew = false; // DISABLED: containsHebrew(originalText);
  
  // DISABLED: Hebrew UI text - always use English
  const uiText = {
    warning: "This comment/post has a high chance of escalating the conversation.",
    suggestLabel: "Consider rephrasing:",
    dismiss: "Dismiss",
    rephrase: "Rephrase",
    generating: "⏳ Generating rephrasing suggestion..."
  };

  // Store the element reference - use the one passed in, or try currentElementBeingChecked, or try to find it
  let targetElement = element || currentElementBeingChecked;
  
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
  
  // Final fallback: if we still don't have a target, try to find it by text content again
  // This helps for replies where the element might have changed
  if (!targetElement || !targetElement.isConnected) {
    console.log("⚠️ Target element not found or disconnected, searching by text content...");
    const allEditable = document.querySelectorAll('[contenteditable="true"], textarea, [role="textbox"]');
    for (let el of allEditable) {
      const elText = getTextContent(el);
      if (elText === originalText || elText.includes(originalText.substring(0, Math.min(20, originalText.length)))) {
        targetElement = el;
        console.log("✅ Found target element by text matching:", el);
        break;
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
  // DISABLED: Hebrew support - removed hebrew-tooltip class
  tooltip.className = `escalation-tooltip`;
  tooltip.innerHTML = `
    <div class="tooltip-container">
      <div class="tooltip-content">
        <p class="tooltip-message">${uiText.warning}</p>
        <div class="tooltip-suggestion" style="display: none;">
          <p class="tooltip-suggestion-label">${uiText.suggestLabel}</p>
          <p class="tooltip-suggestion-text"></p>
        </div>
        <div class="tooltip-buttons">
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

  // Declare rephrasedText early so it's accessible in the dismiss button handler
  // Use undefined to distinguish between: null (already de-escalatory) vs undefined (error)
  let rephrasedText = undefined;
  let rephrasingError = false;

  // IMPORTANT: Attach dismiss button event listener IMMEDIATELY so it works during loading
  // This must be done before the async rephrasing starts
  const dismissBtn = tooltip.querySelector("#dismissBtn");
  if (dismissBtn) {
    dismissBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("🚫 Dismiss button clicked - closing tooltip");
      
      // Log that user dismissed the suggestion (rephrasedText may be empty if still loading)
      logInteraction({
        usersOriginalContent: originalText,
        rephraseSuggestion: (rephrasedText && typeof rephrasedText === 'string') ? rephrasedText : '', // May be empty if dismissed during loading or error
        didUserAccept: 'no',
        escalationType
      });
      
      // Clean up position handlers and remove tooltip
      if (tooltip && tooltip.parentNode) {
        tooltip.remove();
      }
    }, { once: false }); // Allow multiple clicks in case first one doesn't work
  } else {
    console.error("❌ Dismiss button not found in tooltip!");
  }

  // Generate rephrased version (async - uses Gemini API only, no fallback)
  try {
    rephrasedText = await rephraseForDeEscalation(originalText);
    // rephrasedText can be null (already de-escalatory) or a string (rephrased text)
    // undefined means an error occurred
  } catch (error) {
    console.error('❌ Error during rephrasing:', error);
    rephrasingError = true;
    rephrasedText = undefined; // Keep as undefined to distinguish from null (already de-escalatory)
  }
  
  // Update tooltip with the rephrased text
  const suggestionContainer = tooltip.querySelector('.tooltip-suggestion');
  const suggestionText = tooltip.querySelector('.tooltip-suggestion-text');
  const rephraseBtn = tooltip.querySelector('#rephraseBtn') || document.getElementById('rephraseBtn');
  
  // Check if we have a valid rephrased text (string)
  if (suggestionText && rephrasedText && typeof rephrasedText === 'string' && rephrasedText.trim().length > 0) {
    // Show the suggestion container now that we have the rephrased text
    if (suggestionContainer) {
      suggestionContainer.style.display = 'block';
    }
    // DISABLED: Hebrew support - removed Hebrew cleanup
    let finalText = rephrasedText;
    // DISABLED: Hebrew cleanup code
    if (false && (isHebrew || containsHebrew(rephrasedText))) {
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
    // If rephrasing failed or returned null, show appropriate message
    // DISABLED: Hebrew support - always use English error message
    let errorMsg;
    let buttonText = "Rephrase";
    let allowManualRephrase = false;
    
    if (rephrasingError || rephrasedText === undefined) {
      // Error occurred during API call - escalation WAS detected but API failed
      errorMsg = '"Due to a problem, we couldn\'t offer a rephrase. Please try rephrasing on your own."';
      buttonText = "Rephrase on my own";
      allowManualRephrase = true; // Allow user to dismiss and edit manually
      console.log("❌ Rephrasing failed due to error - escalation was detected but API call failed");
    } else if (rephrasedText === null) {
      // API explicitly returned null (text is already de-escalatory)
      // NOTE: If escalation was detected but API returns null, this is contradictory
      // But we trust the API's judgment that it's already de-escalatory
      errorMsg = '"This text is already de-escalatory and does not need rephrasing."';
      buttonText = "Dismiss";
      allowManualRephrase = false;
      console.log("ℹ️ API returned null - text is already de-escalatory (even though escalation was detected)");
    } else {
      // Empty string or other unexpected value - treat as error
      errorMsg = '"Due to a problem, we couldn\'t offer a rephrase. Please try rephrasing on your own."';
      buttonText = "Rephrase on my own";
      allowManualRephrase = true;
      console.log("❌ Unexpected rephrasedText value:", rephrasedText);
    }
    
    if (suggestionText) {
      // DISABLED: No RTL class needed
      suggestionText.textContent = errorMsg;
      // Show the suggestion container even for errors so user knows what happened
      if (suggestionContainer) {
        suggestionContainer.style.display = 'block';
      }
    }
    if (rephraseBtn) {
      rephraseBtn.disabled = false; // Enable button for "Rephrase on my own"
      rephraseBtn.textContent = buttonText;
      rephraseBtn.classList.remove('loading');
      const spinner = rephraseBtn.querySelector('.spinner');
      if (spinner) spinner.remove();
      
      console.log("📊 Button updated:", { text: buttonText, enabled: !rephraseBtn.disabled, allowManualRephrase });
    }
  }
  
  // Log final state
  console.log("📊 Tooltip update complete:", {
    hasRephrasedText: !!rephrasedText && rephrasedText.trim().length > 0,
    rephrasedTextLength: rephrasedText ? rephrasedText.length : 0,
    buttonDisabled: rephraseBtn ? rephraseBtn.disabled : 'button not found',
    buttonInDOM: rephraseBtn ? rephraseBtn.isConnected : false
  });

  // Add event listener for rephrase button (dismiss button already handled above)
  // Use tooltip.querySelector instead of document.getElementById to ensure we get the button from THIS tooltip
  const rephraseBtnElement = tooltip.querySelector("#rephraseBtn");
  
  if (!rephraseBtnElement) {
    console.error("❌ Rephrase button not found in tooltip!");
    return;
  }

  // Determine if this is "Rephrase on my own" case (error occurred)
  const isManualRephraseCase = (rephrasingError || rephrasedText === undefined || 
                                 (rephrasedText !== null && typeof rephrasedText === 'string' && rephrasedText.trim().length === 0));

  rephraseBtnElement.onclick = () => {
    console.log("🔄 Rephrase button clicked");
    console.log("Original:", originalText);
    console.log("Rephrased:", rephrasedText);
    console.log("Is manual rephrase case:", isManualRephraseCase);
    
    // If this is "Rephrase on my own" case (error occurred), just dismiss and let user edit
    if (isManualRephraseCase) {
      console.log("🔄 User will rephrase on their own - dismissing tooltip");
      tooltip.remove();
      // Focus the input so user can edit
      const elementToFocus = targetElement || currentElementBeingChecked;
      if (elementToFocus && elementToFocus.isConnected) {
        elementToFocus.focus();
        // Place cursor at end
        const selection = window.getSelection();
        if (selection && elementToFocus.contentEditable === 'true') {
          const range = document.createRange();
          range.selectNodeContents(elementToFocus);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      return;
    }
    
    // Safety check: ensure we have rephrased text for normal rephrase case
    if (!rephrasedText || typeof rephrasedText !== 'string' || rephrasedText.trim().length === 0) {
      console.error("❌ Cannot rephrase: rephrasedText is empty or null");
      alert("Rephrasing suggestion is not available. Please try again.");
      tooltip.remove();
      return;
    }
    
    // Store element reference and editability state BEFORE any changes
    // Try multiple sources to find the element (important for replies where element might change)
    let elementToRephrase = targetElement || currentElementBeingChecked;
    
    // If element is not found or disconnected, try to find it by text content
    // This is crucial for replies where the DOM might have changed
    if (!elementToRephrase || !elementToRephrase.isConnected) {
      console.log("⚠️ Stored element not found or disconnected, searching for element by text...");
      const allEditable = document.querySelectorAll('[contenteditable="true"], textarea, [role="textbox"]');
      for (let el of allEditable) {
        const elText = getTextContent(el);
        // Match if text is exactly the same or contains the original text
        if (elText === originalText || elText.includes(originalText.substring(0, Math.min(20, originalText.length)))) {
          elementToRephrase = el;
          console.log("✅ Found element by text matching:", el);
          break;
        }
      }
    }
    
    if (!elementToRephrase) {
      console.error("❌ No target element found for rephrasing");
      tooltip.remove();
      return;
    }
    
    console.log("🎯 Using element for rephrasing:", {
      tag: elementToRephrase.tagName,
      contentEditable: elementToRephrase.contentEditable,
      role: elementToRephrase.getAttribute('role'),
      isConnected: elementToRephrase.isConnected,
      currentText: getTextContent(elementToRephrase).substring(0, 50)
    });
    
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
      console.log("🔍 replaceTextInElement returned success=true, will verify text replacement...");
      // Verify the text was actually replaced and re-enable editing
      setTimeout(() => {
        const verifyText = getTextContent(elementToRephrase);
        const wasReplaced = verifyText.trim() === rephrasedText.trim() || 
                           verifyText.includes(rephrasedText.substring(0, 15));
        
        console.log("🔍 Verification check:", {
          verifyText: verifyText.substring(0, 50),
          expectedText: rephrasedText.substring(0, 50),
          wasReplaced: wasReplaced,
          exactMatch: verifyText.trim() === rephrasedText.trim(),
          substringMatch: verifyText.includes(rephrasedText.substring(0, 15))
        });
        
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
          console.log("🎉 Calling showSuccessTooltip with element:", elementToRephrase);
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
      console.error("❌ replaceTextInElement returned success=false");
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
  
  // Initialize post button monitoring to track actual posted text
  setupPostButtonMonitoring();
  
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