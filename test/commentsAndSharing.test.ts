import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  sanitizeCommentPlainText,
  validateArticleCommentInput,
  buildPublicCommentPayload,
  checkCommentRateLimit,
  countApprovedCommentsByPost,
  sortCommentsNewestFirst,
  COMMENT_RATE_LIMIT_COOLDOWN_MS
} from '../src/services/commentService';
import {
  getCanonicalArticleUrl,
  buildArticleShareLinks
} from '../src/components/ArticleShareButton';

const rootDir = process.cwd();

function testReadingTimeRemovedFromUi() {
  const homeCode = fs.readFileSync(path.join(rootDir, 'src/views/HomeView.tsx'), 'utf8');
  const blogCode = fs.readFileSync(path.join(rootDir, 'src/views/BlogView.tsx'), 'utf8');
  const adminBlogCode = fs.readFileSync(
    path.join(rootDir, 'src/components/AdminBlogManager.tsx'),
    'utf8'
  );

  assert.equal(
    homeCode.includes('min read'),
    false,
    'HomeView must not display reading-time labels'
  );
  assert.equal(
    homeCode.includes('readTimeMinutes'),
    false,
    'HomeView must not render readTimeMinutes'
  );
  assert.equal(
    blogCode.includes('min read'),
    false,
    'BlogView must not display reading-time labels'
  );
  assert.equal(
    blogCode.includes('readTimeMinutes'),
    false,
    'BlogView must not render readTimeMinutes'
  );
  assert.equal(
    adminBlogCode.includes('min read'),
    false,
    'AdminBlogManager preview modal must not display reading-time labels'
  );

  console.log('✓ 1. Reading-time labels removed from article cards, reading view, and preview modal');
}

function testCommentSanitizationValidationAndSecurity() {
  // Strips <script>, <iframe>, tags, and dangerous URI protocols
  const dirty =
    'Hello <script>alert("xss")</script><b>Teachers</b>! <img src=x onerror=alert(1)> javascript:void(0)';
  const cleaned = sanitizeCommentPlainText(dirty, { preserveNewlines: true });
  assert.equal(cleaned.includes('<script'), false);
  assert.equal(cleaned.includes('alert("xss")'), false);
  assert.equal(cleaned.includes('<img'), false);
  assert.equal(cleaned.includes('javascript:'), false);
  assert.equal(cleaned.includes('Teachers'), true);

  // Rejects honeypot bot submissions
  const botAttempt = validateArticleCommentInput({
    postId: 'post_123',
    name: 'Spambot',
    content: 'Great article!',
    honeypot: 'http://spam.example'
  });
  assert.equal(botAttempt.valid, false);

  // Enforces name & content minimum/maximum lengths matching firestore.rules
  assert.equal(
    validateArticleCommentInput({
      postId: 'post_123',
      name: 'A',
      content: 'Valid message body'
    }).valid,
    false
  );
  assert.equal(
    validateArticleCommentInput({
      postId: 'post_123',
      name: 'Jean Paul',
      content: 'x'
    }).valid,
    false
  );
  assert.equal(
    validateArticleCommentInput({
      postId: 'post_123',
      name: 'N'.repeat(81),
      content: 'Valid message body'
    }).valid,
    false
  );
  assert.equal(
    validateArticleCommentInput({
      postId: 'post_123',
      name: 'Jean Paul',
      content: 'M'.repeat(2001)
    }).valid,
    false
  );

  // Rejects excessive link spam (> 2 URLs)
  assert.equal(
    validateArticleCommentInput({
      postId: 'post_123',
      name: 'Reader',
      content: 'Check https://a.com https://b.com https://c.com'
    }).valid,
    false
  );

  // Valid submission builds exact 5-key Firestore payload (no email/phone/private PII)
  const validInput = validateArticleCommentInput({
    postId: 'post_abc',
    name: '  Marie Claire  ',
    content: 'Thank you for this helpful CBC update!\nVery clear.'
  });
  assert.equal(validInput.valid, true);
  assert.equal(validInput.sanitizedName, 'Marie Claire');

  const payload = buildPublicCommentPayload({
    postId: validInput.sanitizedPostId,
    name: validInput.sanitizedName,
    content: validInput.sanitizedContent,
    createdAt: '2026-11-13T10:30:00.000Z'
  });
  assert.deepEqual(Object.keys(payload).sort(), [
    'content',
    'createdAt',
    'name',
    'postId',
    'status'
  ]);
  assert.equal(payload.status, 'pending');
  assert.equal('email' in payload, false);
  assert.equal('phone' in payload, false);

  console.log('✓ 2. Comment sanitization, XSS protection, spam guards, and Firestore rule payload verified');
}

function testRateLimitingCountingAndSorting() {
  const now = 1_700_000_000_000;
  assert.equal(checkCommentRateLimit([], now).allowed, true);
  assert.equal(checkCommentRateLimit([now - 5_000], now).allowed, false);
  assert.equal(
    checkCommentRateLimit([now - COMMENT_RATE_LIMIT_COOLDOWN_MS - 100], now).allowed,
    true
  );

  // Reject > 5 submissions within 15 minutes
  const windowTimestamps = [
    now - 120_000,
    now - 100_000,
    now - 80_000,
    now - 60_000,
    now - 25_000
  ];
  assert.equal(checkCommentRateLimit(windowTimestamps, now).allowed, false);

  // Approved comment counts per article ID only count approved messages
  const counts = countApprovedCommentsByPost([
    { postId: 'post_1', status: 'approved' },
    { postId: 'post_1', status: 'approved' },
    { postId: 'post_1', status: 'pending' },
    { postId: 'post_1', status: 'rejected' },
    { postId: 'post_2', status: 'approved' }
  ]);
  assert.equal(counts['post_1'], 2);
  assert.equal(counts['post_2'], 1);

  // Sorting places newest comments first
  const sorted = sortCommentsNewestFirst([
    {
      id: 'c1',
      postId: 'p1',
      name: 'Older',
      content: 'First',
      status: 'approved',
      createdAt: '2026-11-12T08:00:00.000Z'
    },
    {
      id: 'c2',
      postId: 'p1',
      name: 'Newer',
      content: 'Second',
      status: 'approved',
      createdAt: '2026-11-13T09:15:00.000Z'
    }
  ]);
  assert.equal(sorted[0].id, 'c2');

  console.log('✓ 3. Rate limiting, per-article comment counting, and chronological sorting verified');
}

function testShareLinksAndMetadataPreservation() {
  const url = getCanonicalArticleUrl('rwanda-cbc-update', 'https://isezerano.online');
  assert.equal(url, 'https://isezerano.online/blog/rwanda-cbc-update');

  const links = buildArticleShareLinks(
    {
      id: 'post_1',
      slug: 'rwanda-cbc-update',
      title: 'Rwanda CBC Update'
    },
    'https://isezerano.online'
  );

  assert.equal(links.canonicalUrl, 'https://isezerano.online/blog/rwanda-cbc-update');
  assert.equal(links.whatsappUrl.startsWith('https://wa.me/?text='), true);
  assert.equal(
    decodeURIComponent(links.whatsappUrl).includes('https://isezerano.online/blog/rwanda-cbc-update'),
    true
  );
  assert.equal(
    links.facebookUrl,
    'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fisezerano.online%2Fblog%2Frwanda-cbc-update'
  );
  assert.equal(
    links.telegramUrl.startsWith('https://t.me/share/url?url='),
    true
  );
  assert.equal(
    decodeURIComponent(links.telegramUrl).includes('Rwanda CBC Update'),
    true
  );

  console.log('✓ 4. Share links (WhatsApp, Facebook, Telegram, Canonical Copy URL) verified');
}

function testUiWiringAndAdminModeration() {
  const homeCode = fs.readFileSync(path.join(rootDir, 'src/views/HomeView.tsx'), 'utf8');
  const blogCode = fs.readFileSync(path.join(rootDir, 'src/views/BlogView.tsx'), 'utf8');
  const appCode = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8');
  const commentsCode = fs.readFileSync(
    path.join(rootDir, 'src/components/ArticleCommentsSection.tsx'),
    'utf8'
  );
  const shareCode = fs.readFileSync(
    path.join(rootDir, 'src/components/ArticleShareButton.tsx'),
    'utf8'
  );
  const adminCode = fs.readFileSync(
    path.join(rootDir, 'src/components/AdminBlogManager.tsx'),
    'utf8'
  );
  const commentServiceCode = fs.readFileSync(
    path.join(rootDir, 'src/services/commentService.ts'),
    'utf8'
  );

  assert.equal(homeCode.includes('ArticleShareButton'), true);
  assert.equal(homeCode.includes('handleOpenComments'), true);
  assert.equal(blogCode.includes('ArticleCommentsSection'), true);
  assert.equal(blogCode.includes('ArticleShareButton'), true);
  assert.equal(blogCode.includes('updateBlogPostSeo'), true);
  assert.equal(appCode.includes('subscribeToApprovedCommentCounts'), true);
  assert.equal(appCode.includes('focusArticleComments'), true);

  assert.equal(commentsCode.includes('id="article-comments"'), true);
  assert.equal(commentsCode.includes('formattedDate'), true);
  assert.equal(commentsCode.includes('formattedTime'), true);
  assert.equal(commentsCode.includes('dangerouslySetInnerHTML'), false, 'Comments must never use dangerouslySetInnerHTML');

  assert.equal(shareCode.includes('navigator.share'), true);
  assert.equal(shareCode.includes('WhatsApp'), true);
  assert.equal(shareCode.includes('Facebook'), true);
  assert.equal(shareCode.includes('Telegram'), true);
  assert.equal(shareCode.includes('Copy article link'), true);

  // Admin moderation controls
  assert.equal(adminCode.includes("setDashboardTab('comments')"), true);
  assert.equal(adminCode.includes('subscribeToAllCommentsForAdmin'), true);
  assert.equal(adminCode.includes("handleModerateComment(comment, 'approved')"), true);
  assert.equal(adminCode.includes("handleModerateComment(comment, 'rejected')"), true);
  assert.equal(adminCode.includes('handleConfirmDeleteComment'), true);

  // Public Firestore queries must always filter status == 'approved'
  assert.equal(commentServiceCode.includes("where('status', '==', 'approved')"), true);

  console.log('✓ 5. Card Comment/Share buttons, Comments UI, Admin Moderation, and OG SEO preservation verified');
}

testReadingTimeRemovedFromUi();
testCommentSanitizationValidationAndSecurity();
testRateLimitingCountingAndSorting();
testShareLinksAndMetadataPreservation();
testUiWiringAndAdminModeration();
console.log('\nALL BLOG COMMENTS, MODERATION, SHARING & UI TESTS PASSED!');
