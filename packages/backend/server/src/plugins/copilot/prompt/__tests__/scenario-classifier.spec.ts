import test from 'ava';

import { ScenarioClassifier } from '../scenario-classifier.js';

const classifier = new ScenarioClassifier();

test('rule 1 — audio attachment dispatches to audio_transcribing', t => {
  t.is(
    classifier.classify({
      content: 'transcribe this recording',
      attachments: [
        // Use the legacy {attachment, mimeType} shape — covered by attachmentMimeType.
        { attachment: 'handle://abc', mimeType: 'audio/mpeg' } as any,
      ],
    }),
    'audio_transcribing'
  );
});

test('rule 2 — image attachment + edit keyword dispatches to image', t => {
  t.is(
    classifier.classify({
      content: 'convert this to anime style',
      attachments: [
        { attachment: 'https://example.com/photo.jpg', mimeType: 'image/jpeg' } as any,
      ],
    }),
    'image'
  );
});

test('rule 3 — "function" keyword dispatches to coding', t => {
  t.is(
    classifier.classify({ content: 'write a function that parses JSON' }),
    'coding'
  );
});

test('rule 3 — "fix bug" phrase dispatches to coding', t => {
  t.is(
    classifier.classify({ content: 'please fix bug in the login handler' }),
    'coding'
  );
});

test('rule 4 — short message dispatches to quick_decision_making', t => {
  const content = 'what is the capital of France?';
  t.true(content.length < 80);
  t.is(classifier.classify({ content }), 'quick_decision_making');
});

test('rule 5 — medium message + summarize dispatches to polish_and_summarize', t => {
  const content =
    'Can you summarize the following meeting notes? The team discussed quarterly goals, sprint planning and release timelines.';
  t.true(content.length >= 80 && content.length <= 300);
  t.is(classifier.classify({ content }), 'polish_and_summarize');
});

test('rule 6 — long message + brainstorm keyword dispatches to complex_text_generation', t => {
  const content =
    'I need to brainstorm ideas for a new product launch. We are targeting enterprise customers in the healthcare sector. ' +
    'The product needs to address compliance requirements, integrate with existing EHR systems, and provide real-time analytics. ' +
    'Please help me think through a go-to-market strategy, key differentiators, and potential roadblocks we might encounter.';
  t.true(content.length > 300);
  t.is(classifier.classify({ content }), 'complex_text_generation');
});

test('rule 7 — medium message with no special keywords dispatches to quick_text_generation', t => {
  const content =
    'Please write a short paragraph describing the benefits of regular exercise for overall well-being.';
  t.true(content.length >= 80 && content.length <= 300);
  t.is(classifier.classify({ content }), 'quick_text_generation');
});

test('rule 8 — long message with no special keywords falls back to chat', t => {
  const content =
    'I have been thinking about what makes a great engineering culture. There are many factors: psychological safety, ' +
    'clear ownership, fast feedback loops, and a shared commitment to quality. Over the years I have noticed that teams ' +
    'who ship the best work invest heavily in onboarding, code review culture, and have a genuine bias toward simplicity ' +
    'over cleverness. How do we measure and improve this in our organization?';
  t.true(content.length > 300);
  t.is(classifier.classify({ content }), 'chat');
});
