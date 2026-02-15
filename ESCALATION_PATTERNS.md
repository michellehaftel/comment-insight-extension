# All Escalation Detection Patterns

**Threshold:** Score ≥ 2.5 triggers escalation  
**Minimum length:** 8 characters (or bypassed if `hasHighRiskKeywords` matches)

---

## Pre-check: hasHighRiskKeywords

Used to bypass minimum length for short text. Simple substring matching:

| Keywords |
|----------|
| you're wrong, you are wrong, are wrong, always wrong |
| your fault, it's your fault |
| you idiot, you're an idiot |
| you always, you never |
| i hate, i can't stand, i can't believe |
| this is insane, shut up, this makes me sick |
| worst, worst mistake, worst thing |
| stupid, dumb, idiot, moron, ass, asshole |
| hate, disgusting, disgusting creature, ridiculous |
| brainwashed, never work, will never |
| anyone who supports |
| everything that is bad, everything that is wrong |
| what a stupid, what a disgusting, what a terrible |
| once, always an, forever |
| + profanity keywords (fuck, shit, damn, bitch, etc.) |

---

## 1. absoluteTruthPatterns (+2 each)

```
/\b(you are wrong|you're wrong)\b/i
/\b(you are (?:always|never|totally|completely|absolutely|so|just) wrong)\b/i
/\b(you're (?:always|never|totally|completely|absolutely|so|just) wrong)\b/i
/\b(?:are|is) (?:always|never|totally|completely|absolutely) wrong\b/i
/\b(i am right|i'm right)\b/i
/\b(i totally disagree|completely disagree|absolutely wrong)\b/i
/\b(that's not true|that is not true|that's false)\b/i
/\b(you don't understand|you don't get it)\b/i
/\b(that's ridiculous|that's absurd|that's stupid)\b/i
/\b(that's (?:a|an) (?:stupid|ridiculous|absurd|terrible|awful|horrible|disgusting|pathetic|dumb|idiotic))\b/i
/\b(?:their|his|her) (?:ridiculous|absurd|stupid|idiotic) (?:ideas?|views?|opinions?)\b/i
/\bwill never work\b/i
/\bwill always (?:fail|lose|be wrong)\b/i
```

---

## 2. generalizedPatterns (+2 each)

```
/\b(the (?:arabs|palestinians|jews|israelis|leftists|rightists|republicans|democrats|liberals|conservatives))\b/i
/\b(all (?:arabs|palestinians|jews|israelis|leftists|rightists|republicans|democrats|liberals|conservatives|of them|of you))\b/i
/\b(every (?:arab|palestinian|jew|israeli|leftist|rightist|republican|democrat|liberal|conservative))\b/i
/\b(they all|you all|all of you|all of them)\b/i
/\b(?:those|these) (?:people|guys|folks) (?:on the (?:other side|left|right))\b/i
/\b(?:anyone|everyone|everybody) who (?:supports?|believes?|thinks?|agrees?)\b/i
/\b(you (?:lefties?|righties?|libs?|conservatives?|republicans?|democrats?|liberals?|progressives?|leftists?|rightists?|arabs?|palestinians?|jews?|israelis?|zionists?))\b/i
/\b(you (?:people|guys|folks|ones) (?:on the (?:left|right|other side)))\b/i
/\b(you (?:left|right|liberal|conservative) (?:people|guys|folks|ones|snowflakes|nutjobs|wackos))\b/i
```

---

## 3. categoricalWords (+1 if count ≥ 1)

```
/\b(always|never|everyone|nobody|nothing|everything|neither|either)\b/i
/\b(only|solely|exclusively|completely|totally|absolutely|definitely|certainly|just|actually)\b/i
```

---

## 4. onceAlwaysPattern (+2.5)

```
/\bonce (?:an? |a )?\w+, (?:always|forever) (?:an? |a )?\w+/i
```
e.g. "once a fool, always a fool"

---

## 5. onlyVerbPattern (+1.5)

```
/\bonly (?:cares?|cared|wants?|wanted|thinks?|thought|thinks about|cares about|wants? about|does|did|knows?|know|sees?|saw|understands?|understood|believes?|believed|matters?|mattered|interests?|interested)\b/i
```

---

## 6. blamePatterns (+2 each)

```
/\b(you (?:always|never|can't|don't|won't|shouldn't|are|were|did|do|have|had))\b/i
/\b(you (?:always|never) (?:do|say|think|act|behave))\b/i
/\b(you're (?:always|never|just|so|too|being))\b/i
/\b(you (?:lefties?|righties?|libs?|people|guys|folks) (?:always|never|can't|don't|have no|have zero))\b/i
/\b(you (?:lefties?|righties?|libs?|conservatives?|people|guys|folks) (?:don't understand|don't get it|don't know|have no idea))\b/i
/\b(you (?:make|made|cause|caused|force|forced) (?:me|us|this|that)(?:\s+\w+)?)/i
/\b(you (?:make|made) (?:me|us) (?:feel )?(?:sick|angry|sad|mad|upset|disgusted|furious|annoyed|frustrated|disappointed))\b/i
/\b(it's (?:your|you're) (?:fault|problem|issue|doing))\b/i
/\b(?:your|you're) (?:fault|problem|issue|doing)\b/i
/\b(?:this|that|it) (?:is|was) (?:your|you're) (?:fault|problem)\b/i
/\b(?:absolutely|completely|totally) (?:your|you're)\b/i
```

---

## 7. mockingPatterns (+1.5 each)

```
/\b(you always\.\.\.|you never\.\.\.)\b/i
/\b(oh please|come on|seriously|give me a break)\b/i
/\b(typical|of course|naturally|predictably)\b/i
/\b(wow|really|sure|right)\b/i
```

---

## 8. dismissivePatterns (+1.5 each)

```
/\b(that's not (?:true|real|how it works|the point))\b/i
/\b(you're (?:wrong|mistaken|confused|misinformed))\b/i
/\b(this is|it's|it is|that's|that is) (?:wrong|ridiculous|absurd|stupid|terrible|awful|insane)\b/i
/\bwrong (?:on|in) (?:so many|so many different) (?:levels?|ways?)\b/i
/\b(that doesn't (?:matter|count|make sense|work))\b/i
/\b(i don't (?:care|give a|want to hear))\b/i
/\b(whatever|who cares|so what)\b/i
```

---

## 9. dismissiveRelationshipPatterns (+2 each)

```
/\bis just (?:a|an) (?:political theater|show|act|game|joke|charade)\b/i
/\bis (?:nothing but|only|merely|simply) (?:a|an) (?:political theater|show|act|game|joke|charade)\b/i
/\b(?:neither|either) (?:actually|really|truly|genuinely) (?:care|cares|care about|matter|matters)\b/i
/\b(?:they|he|she) (?:don't|doesn't) (?:actually|really|truly|genuinely) (?:care|matter|mean it)\b/i
/\b(?:their|his|her) (?:relationship|friendship|alliance) is (?:just|only|merely|simply|nothing but)\b/i
```

---

## 10. judgingPatterns (+2 each)

```
/\b(you're (?:terrible|awful|horrible|disgusting|pathetic|ridiculous|stupid|dumb|an idiot|a moron|an ass|an asshole))\b/i
/\b(you're being (?:terrible|awful|horrible|disgusting|pathetic|ridiculous|stupid|dumb|idiotic|an idiot|a moron|absurd|childish|unreasonable|unfair|unjust))\b/i
/\b(you are such a (?:dumb (?:ass|asshole)|idiot|moron|jerk|fool|terrible|awful|horrible|disgusting|pathetic|ridiculous|stupid))\b/i
/\b(you are (?:so |such )?(?:terrible|awful|horrible|disgusting|pathetic|ridiculous|stupid|dumb(?:ass| ass)?|idiot|moron|ass(?:hole)?|jerk|fool))\b/i
/\b(you are (?:a|an|the) (?:disgusting|terrible|awful|horrible|pathetic|ridiculous|stupid|dumb|worst|bad|worst|vile|repulsive|despicable|contemptible) (?:creature|mistake|person|human|thing|being|scum|filth|waste|joke|disgrace|shame|failure|monster|beast|animal))\b/i
/\b\w+ (?:is|are|was|were) (?:a|an|the) (?:disgusting|terrible|awful|horrible|pathetic|ridiculous|stupid|dumb|worst|bad|vile|repulsive|despicable|contemptible) (?:creature|mistake|person|human|thing|being|scum|filth|waste|joke|disgrace|shame|failure|monster|beast|animal)\b/i
/\b\w+ (?:is|are|was|were) such a (?:mistake|failure|disgrace|shame|joke|monster|beast|animal|creature|scum|filth|waste|disaster|tragedy|nightmare|curse|plague|burden|problem|issue|threat|danger|liability)\b/i
/\b(you are such a (?:mistake|failure|disgrace|shame|joke|monster|beast|animal|creature|scum|filth|waste|disaster|tragedy|nightmare|curse|plague|burden|problem|issue|threat|danger|liability))\b/i
/\b(you are (?:a|an|the) (?:mistake|failure|disgrace|shame|joke|monster|beast|animal|creature|scum|filth|waste|disaster|tragedy|nightmare|curse|plague|burden|problem|issue|threat|danger|liability|embarrassment|disappointment|fraud|fake|imposter|hypocrite|coward|traitor|enemy|foe|opponent|adversary|villain|criminal|evil|poison|disease|cancer|virus|pest|parasite|leech|freeloader))\b/i
/\b(you are everything (?:that is|which is) (?:bad|wrong|evil|terrible|awful|horrible|disgusting|pathetic|ridiculous|stupid|wrong with|terrible about))\b/i
/\b(you are (?:the|your|a) worst (?:mistake|thing|person|human|decision|choice|example|representation|embodiment|excuse|reason|excuse|excuse for|joke|disgrace|shame|failure))\b/i
/\b(what a (?:stupid|disgusting|terrible|awful|horrible|pathetic|ridiculous|dumb|idiotic|vile|repulsive|despicable|contemptible) (?:human|person|creature|thing|joke|disgrace|shame|failure|mistake|being|monster|beast|animal|idiot|moron|fool|jerk))\b/i
/\b(i (?:can't|cannot) believe (?:you|that) (?:are|were|would|still|actually|really))\b/i
/\b(that's (?:terrible|awful|horrible|disgusting|pathetic|ridiculous|stupid|dumb|idiotic))\b/i
/\b(that's (?:a|an) (?:terrible|awful|horrible|disgusting|pathetic|ridiculous|stupid|dumb|idiotic) (?:argument|idea|point|statement|claim|thing|view|opinion))\b/i
/\b(how (?:dare|could) you)\b/i
/\b(you should (?:be ashamed|feel bad|know better))\b/i
/\b(?:is|are|was|were) (?:brainwashed|indoctrinated|deluded|insane|crazy)\b/i
/\b(?:anyone|everyone) who (?:supports?|believes?|agrees?) (?:them|this|that) is (?:brainwashed|deluded|insane|crazy|stupid|an idiot)\b/i
/\b(?:once|once a) (?:an? )?(?:asshole|ass|idiot|moron|jerk|fool|bastard), (?:always|forever) (?:an? )?(?:asshole|ass|idiot|moron|jerk|fool|bastard)\b/i
/\b(?:he's|she's|they're|he is|she is|they are) (?:an? )?(?:asshole|ass|idiot|moron|jerk|fool|bastard)\b/i
/\b(?:just )?(?:an? )?(?:asshole|bastard)\b/i
```

---

## 11. Profanity

**negativeWords (used with curse):** ridiculous, terrible, awful, horrible, stupid, idiotic, disgusting, pathetic, wrong, bad, worse, worst, hate, hated, annoying, frustrating, useless, pointless, garbage, trash, crazy, insane, dumb, absurd, nonsense, idiot, moron, jerk, fool, hateful, offensive

**curseWords:** fuck, fucking, fucked, fucker, fucks, shit, shitting, shitted, shits, shitty, shite, damn, damned, damnit, dammit, goddamn, goddamnit, goddamned, godsdamn, hell, hellish, bitch, bitches, bitching, bastard, bastards, cunt, cunts, dick, dicks, dickhead, prick, pricks, cock, cocks, cocksucker, motherfucker, bullshit, horseshit, piss, pissing, pissed, wanker, twat, arse, arsehole, ass, asshole, bugger, bollocks, crap, dumb-ass, jack-ass, jackass, fag, faggot, dyke, kike, tranny, slut, spastic, nigga, nigra, + compound curse words

- **Profanity + negative context:** +4
- **Direct profanity patterns** (fuck you, asshole, etc.): +3
- **Standalone curse word:** +2.5

---

## 12. directProfanityPatterns (+3 each)

```
/\b(?:fuck (?:you|off|this|that|it|him|her|them|yourself))\b/i
/\b(?:fucker|fucked up)\b/i
/\b(?:piss (?:off|you))\b/i
/\b(?:screw (?:you|off))\b/i
/\b(?:go to hell)\b/i
/\b(?:damn you)\b/i
/\b(?:bitch|bitches|bitching)\b/i
/\b(?:bastard|bastards)\b/i
/\b(?:cunt|cunts)\b/i
/\b(?:dickhead|dick-head)\b/i
/\b(?:motherfucker|motherfuckers|motherfucking|mother-fucker)\b/i
/\b(?:son of a bitch|sob)\b/i
/\b(?:bullshit|horseshit)\b/i
/\b(?:arsehole|arseholes|asshole|assholes)\b/i
/\b(?:fag|faggot|dyke|kike|tranny|slut|spastic)\b/i
/\b(?:nigga|nigra)\b/i
/\b(?:f off|f\*\*\*)\b/i
/\b(?:s\*\*\*)\b/i
```

---

## 13. theyBlamePatterns (+1.5 each)

```
/\b(they (?:always|never|all|all of them|are|were|do|did))\b/i
/\b(they're (?:all|always|never|just|so|too))\b/i
/\b(they (?:make|made|cause|caused|force|forced) (?:me|us|this|that))\b/i
```

---

## 14. Non-verbal cues

- **≥2 exclamation marks:** +1
- **>30% CAPS and length >20:** +1.5
- **≥3 question marks:** +1

---

## 15. Combination bonus (+1)

If text has both **argumentative** (absolute truth, generalized, categorical) AND **blame** (blaming, mocking, dismissive, judging, group blaming) patterns.
