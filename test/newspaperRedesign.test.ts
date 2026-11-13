import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const rootDir = process.cwd();

function testHeaderNewspaperNavigationAndOverflowMenu() {
  const headerCode = fs.readFileSync(path.join(rootDir, 'src/components/WebsiteHeader.tsx'), 'utf8');

  // Split around the Tier 2 navigation bar comment
  const tier2Marker = 'TIER 2: NEWSPAPER CATEGORY NAVIGATION BAR';
  const tier2Index = headerCode.indexOf(tier2Marker);
  assert.equal(tier2Index > 0, true, 'WebsiteHeader must contain Tier 2 newspaper category navigation bar');

  const tier1OverflowSection = headerCode.slice(0, tier2Index);
  const tier2NavSection = headerCode.slice(tier2Index);

  // 1. Moved sections MUST live inside the three-dot (⋮) overflow menu in Tier 1
  for (const movedSection of ['Lesson Preparation', 'CBC Report Cards N1-N3', 'Admin Portal']) {
    assert.equal(
      tier1OverflowSection.includes(movedSection),
      true,
      `Overflow menu must include moved section: ${movedSection}`
    );
    assert.equal(
      tier2NavSection.includes(movedSection),
      false,
      `Main newspaper nav bar must NOT display non-newspaper section: ${movedSection}`
    );
  }

  for (const excludedMainItem of ['Ahabanza (Home)', 'Blog & Articles']) {
    assert.equal(
      tier2NavSection.includes(excludedMainItem),
      false,
      `Main newspaper nav bar must NOT display legacy item: ${excludedMainItem}`
    );
  }

  // Preserved route actions inside overflow menu
  assert.equal(tier1OverflowSection.includes("handleNavClick('dashboard')"), true);
  assert.equal(tier1OverflowSection.includes("handleNavClick('nursery')"), true);
  assert.equal(tier1OverflowSection.includes("handleNavClick('admin')"), true);
  assert.equal(tier1OverflowSection.includes('MoreVertical'), true);

  // 2. Main navigation bar dynamically uses Firestore blog categories
  assert.equal(headerCode.includes('subscribeToBlogCategories'), true);
  assert.equal(headerCode.includes('mergeCategoriesForDisplay'), true);
  assert.equal(tier2NavSection.includes('All News'), true);
  assert.equal(tier2NavSection.includes('resolvedCategories.map'), true);
  assert.equal(tier2NavSection.includes('whitespace-nowrap shrink-0'), true);

  console.log('✓ 1. Newspaper category bar & three-dot overflow menu (Lesson Prep, CBC Report Cards N1-N3, Admin Portal) verified');
}

function testNewspaperHomepageStructure() {
  const homeCode = fs.readFileSync(path.join(rootDir, 'src/views/HomeView.tsx'), 'utf8');
  const appCode = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8');
  const thumbCode = fs.readFileSync(path.join(rootDir, 'src/components/ArticleThumbnailImage.tsx'), 'utf8');

  // Homepage displays news front page rather than Lesson Plan / Report Card hero cards
  assert.equal(homeCode.includes('Create Lesson Plan'), false, 'Homepage must prioritize news over Lesson Plan hero card');
  assert.equal(homeCode.includes('Open Report Cards'), false, 'Homepage must prioritize news over Report Cards hero card');

  // Featured story, latest headlines wire, recent articles, category sections
  for (const marker of [
    'getSingleArticleThumbnailUrl',
    'ArticleThumbnailImage',
    'Latest Headlines',
    'Latest News',
    'categorySections.map',
    'extractPlainTextExcerpt',
    'showWebsiteName',
    'showWebsiteDescription'
  ]) {
    assert.equal(homeCode.includes(marker), true, `HomeView missing expected newspaper element: ${marker}`);
  }

  // Thumbnails must handle missing images cleanly and preserve aspect ratios
  assert.equal(thumbCode.includes('Article placeholder'), true);
  assert.equal(homeCode.includes('object-cover'), true);

  // App.tsx connects live Firestore posts & categories to Header, HomeView, and BlogView
  assert.equal(appCode.includes('subscribeToBlogPosts'), true);
  assert.equal(appCode.includes('subscribeToBlogCategories'), true);
  assert.equal(appCode.includes('handleOpenNewspaperArticle'), true);
  assert.equal(appCode.includes('AdminPortalGateway'), true);
  assert.equal(appCode.includes('LessonPlanAuthGate'), true);

  console.log('✓ 2. Newspaper homepage hierarchy, thumbnails, category sections, and preserved auth routes verified');
}

testHeaderNewspaperNavigationAndOverflowMenu();
testNewspaperHomepageStructure();
console.log('\nALL NEWSPAPER REDESIGN & NAVIGATION TESTS PASSED!');
