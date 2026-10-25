import * as cheerio from 'cheerio';

/**
 * SEO & Metadata Auditor
 * Analyzes HTML via Cheerio for essential and advisory SEO factors.
 */
export function auditSEO(html, targetUrl) {
  const $ = cheerio.load(html);
  const findings = [];

  // 1. Page Title Check
  const titleTag = $('title');
  const titleText = titleTag.text().trim();

  if (titleTag.length === 0) {
    findings.push({
      id: 'seo-title-missing',
      category: 'seo',
      severity: 'critical',
      title: 'Missing <title> tag',
      description: 'The webpage has no <title> element in the HTML document head.',
      evidence: '<head> contains no <title>',
      selector: 'head',
      recommendation: 'Add a concise, descriptive <title> tag inside the <head> element (e.g., <title>Product Name — Brief Value Proposition</title>).'
    });
  } else if (!titleText) {
    findings.push({
      id: 'seo-title-empty',
      category: 'seo',
      severity: 'critical',
      title: 'Empty <title> tag',
      description: 'A <title> tag exists in the document head, but contains no text.',
      evidence: '<title></title>',
      selector: 'title',
      recommendation: 'Fill in the <title> tag with a unique, descriptive page title.'
    });
  } else {
    // Title length evaluation
    if (titleText.length < 20) {
      findings.push({
        id: 'seo-title-short',
        category: 'seo',
        severity: 'warning',
        title: 'Page title is unusually short',
        description: `The page title is only ${titleText.length} characters long. Search engines prefer titles between 30 and 60 characters.`,
        evidence: `"${titleText}" (${titleText.length} characters)`,
        selector: 'title',
        recommendation: 'Expand your title tag to 30–60 characters to include relevant brand and keyword context.'
      });
    } else if (titleText.length > 70) {
      findings.push({
        id: 'seo-title-long',
        category: 'seo',
        severity: 'warning',
        title: 'Page title exceeds recommended length',
        description: `The page title is ${titleText.length} characters long. Search engine results typically truncate titles longer than 60–70 characters.`,
        evidence: `"${titleText}" (${titleText.length} characters)`,
        selector: 'title',
        recommendation: 'Condense your title to under 60 characters so it fits neatly into search engine result pages.'
      });
    } else {
      findings.push({
        id: 'seo-title-passed',
        category: 'seo',
        severity: 'passed',
        title: 'Page title is well configured',
        description: `The page title is present, descriptive, and within optimal length (${titleText.length} characters).`,
        evidence: `"${titleText}"`,
        selector: 'title',
        recommendation: 'No action needed.'
      });
    }
  }

  // 2. Meta Description Check
  const metaDescriptionTag = $('meta[name="description" i]');
  const metaDescriptionContent = metaDescriptionTag.attr('content')?.trim() || '';

  if (metaDescriptionTag.length === 0) {
    findings.push({
      id: 'seo-meta-desc-missing',
      category: 'seo',
      severity: 'critical',
      title: 'Missing meta description tag',
      description: 'No <meta name="description"> tag was found. Search engines use this to display summary snippets in search results.',
      evidence: 'No <meta name="description"> in <head>',
      selector: 'head',
      recommendation: 'Add a <meta name="description" content="..."> tag in your <head> summarizing the page content in 120–160 characters.'
    });
  } else if (!metaDescriptionContent) {
    findings.push({
      id: 'seo-meta-desc-empty',
      category: 'seo',
      severity: 'critical',
      title: 'Empty meta description content',
      description: 'A <meta name="description"> tag is present, but its content attribute is blank.',
      evidence: '<meta name="description" content="" />',
      selector: 'meta[name="description"]',
      recommendation: 'Add a compelling description of the page content into the content attribute.'
    });
  } else {
    if (metaDescriptionContent.length < 50) {
      findings.push({
        id: 'seo-meta-desc-short',
        category: 'seo',
        severity: 'warning',
        title: 'Meta description is very short',
        description: `Meta description is only ${metaDescriptionContent.length} characters long. Aim for 120–160 characters for optimal click-through rates.`,
        evidence: `"${metaDescriptionContent.slice(0, 100)}..." (${metaDescriptionContent.length} characters)`,
        selector: 'meta[name="description"]',
        recommendation: 'Expand the description to 120–160 characters to communicate more value to prospective visitors.'
      });
    } else if (metaDescriptionContent.length > 170) {
      findings.push({
        id: 'seo-meta-desc-long',
        category: 'seo',
        severity: 'warning',
        title: 'Meta description may be truncated',
        description: `Meta description is ${metaDescriptionContent.length} characters long. Google typically clips snippets longer than ~160 characters.`,
        evidence: `"${metaDescriptionContent.slice(0, 100)}..." (${metaDescriptionContent.length} characters)`,
        selector: 'meta[name="description"]',
        recommendation: 'Trim the meta description to under 160 characters so it displays cleanly without ellipsis truncation.'
      });
    } else {
      findings.push({
        id: 'seo-meta-desc-passed',
        category: 'seo',
        severity: 'passed',
        title: 'Meta description is optimal',
        description: `Meta description is properly configured with an effective length of ${metaDescriptionContent.length} characters.`,
        evidence: `"${metaDescriptionContent.slice(0, 120)}..."`,
        selector: 'meta[name="description"]',
        recommendation: 'No action needed.'
      });
    }
  }

  // 3. Headings Structure (H1 and hierarchy)
  const h1Elements = $('h1');
  const h1Count = h1Elements.length;
  const h2Count = $('h2').length;
  const h3Count = $('h3').length;

  if (h1Count === 0) {
    findings.push({
      id: 'seo-h1-missing',
      category: 'seo',
      severity: 'critical',
      title: 'Missing <h1> heading',
      description: 'The page has no <h1> heading element. Search engines and screen readers rely on <h1> to identify the primary topic of the page.',
      evidence: 'No <h1> tags found in document body',
      selector: 'body',
      recommendation: 'Include exactly one prominent <h1> tag that describes the central subject of the page.'
    });
  } else if (h1Count > 1) {
    const h1Texts = [];
    h1Elements.each((_, el) => {
      const txt = $(el).text().trim().replace(/\s+/g, ' ');
      if (txt) h1Texts.push(txt);
    });
    findings.push({
      id: 'seo-h1-multiple',
      category: 'seo',
      severity: 'warning',
      title: 'Multiple <h1> headings found',
      description: `Found ${h1Count} <h1> headings on the page. While HTML5 technically permits multiple <h1> tags in sectioning elements, standard SEO best practices recommend having a single primary <h1> per document.`,
      evidence: `Found ${h1Count} <h1> tags: ${h1Texts.slice(0, 3).map(t => `"${t}"`).join(', ')}${h1Texts.length > 3 ? '...' : ''}`,
      selector: 'h1',
      recommendation: 'Designate one main <h1> for the primary page title and convert secondary section titles to <h2> or <h3>.'
    });
  } else {
    const singleH1Text = h1Elements.first().text().trim().replace(/\s+/g, ' ');
    findings.push({
      id: 'seo-h1-passed',
      category: 'seo',
      severity: 'passed',
      title: 'Single primary <h1> heading present',
      description: 'The page features a single clear <h1> heading.',
      evidence: `<h1>${singleH1Text.slice(0, 80)}${singleH1Text.length > 80 ? '...' : ''}</h1>`,
      selector: 'h1',
      recommendation: 'No action needed.'
    });
  }

  // 4. Viewport Meta Tag Check (Essential for Mobile SEO & Responsiveness)
  const viewportTag = $('meta[name="viewport" i]');
  const viewportContent = viewportTag.attr('content')?.toLowerCase() || '';

  if (viewportTag.length === 0) {
    findings.push({
      id: 'seo-viewport-missing',
      category: 'seo',
      severity: 'critical',
      title: 'Missing viewport meta tag',
      description: 'No <meta name="viewport"> tag was detected. Without this, mobile browsers will render the page at desktop screen widths, resulting in a poor mobile experience.',
      evidence: 'No <meta name="viewport"> found in <head>',
      selector: 'head',
      recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0"> inside your <head> tags.'
    });
  } else if (!viewportContent.includes('width=device-width') || !viewportContent.includes('initial-scale')) {
    findings.push({
      id: 'seo-viewport-incomplete',
      category: 'seo',
      severity: 'warning',
      title: 'Incomplete viewport configuration',
      description: 'A viewport meta tag was found, but it is missing standard recommended properties like width=device-width or initial-scale=1.0.',
      evidence: `<meta name="viewport" content="${viewportContent}">`,
      selector: 'meta[name="viewport"]',
      recommendation: 'Update your viewport tag to: <meta name="viewport" content="width=device-width, initial-scale=1.0">'
    });
  } else {
    findings.push({
      id: 'seo-viewport-passed',
      category: 'seo',
      severity: 'passed',
      title: 'Viewport meta tag is properly configured',
      description: 'Mobile viewport tag is present and configured for device-width scaling.',
      evidence: `<meta name="viewport" content="${viewportContent}">`,
      selector: 'meta[name="viewport"]',
      recommendation: 'No action needed.'
    });
  }

  // 5. Canonical URL Check
  const canonicalTag = $('link[rel="canonical" i]');
  const canonicalHref = canonicalTag.attr('href')?.trim() || '';

  if (canonicalTag.length === 0) {
    findings.push({
      id: 'seo-canonical-missing',
      category: 'seo',
      severity: 'warning',
      title: 'Missing canonical URL link',
      description: 'No <link rel="canonical"> tag was found. A canonical link specifies the preferred URL for search engines, preventing duplicate content dilution.',
      evidence: 'No <link rel="canonical"> in <head>',
      selector: 'head',
      recommendation: `Add a canonical link tag: <link rel="canonical" href="${targetUrl}" />`
    });
  } else if (!canonicalHref) {
    findings.push({
      id: 'seo-canonical-empty',
      category: 'seo',
      severity: 'warning',
      title: 'Empty canonical URL link',
      description: 'A canonical link tag was found, but the href attribute is empty.',
      evidence: '<link rel="canonical" href="" />',
      selector: 'link[rel="canonical"]',
      recommendation: 'Provide the definitive canonical URL in the href attribute.'
    });
  } else {
    findings.push({
      id: 'seo-canonical-passed',
      category: 'seo',
      severity: 'passed',
      title: 'Canonical URL is specified',
      description: 'A canonical link tag is properly specified.',
      evidence: `<link rel="canonical" href="${canonicalHref}" />`,
      selector: 'link[rel="canonical"]',
      recommendation: 'No action needed.'
    });
  }

  // 6. Image Alt Attributes Check
  const allImages = $('img');
  const totalImages = allImages.length;
  let missingAltCount = 0;
  const missingAltSamples = [];

  allImages.each((_, img) => {
    const alt = $(img).attr('alt');
    const src = $(img).attr('src') || $(img).attr('data-src') || 'unspecified src';
    if (alt === undefined) {
      missingAltCount++;
      if (missingAltSamples.length < 3) {
        missingAltSamples.push(`<img src="${src.slice(0, 60)}${src.length > 60 ? '...' : ''}">`);
      }
    }
  });

  if (totalImages === 0) {
    findings.push({
      id: 'seo-images-none',
      category: 'seo',
      severity: 'info',
      title: 'No <img> elements found on page',
      description: 'The document does not include any standard HTML image elements.',
      evidence: '0 <img> tags',
      selector: 'body',
      recommendation: 'Ensure illustrative imagery or SVG diagrams are used where beneficial for user engagement.'
    });
  } else if (missingAltCount > 0) {
    findings.push({
      id: 'seo-img-alt-missing',
      category: 'seo',
      severity: missingAltCount > 5 ? 'critical' : 'warning',
      title: `${missingAltCount} image${missingAltCount > 1 ? 's' : ''} missing alt attributes`,
      description: `${missingAltCount} out of ${totalImages} images do not have an alt attribute. Alt attributes are critical for search engine image indexing and accessibility screen readers.`,
      evidence: `Missing alt on: ${missingAltSamples.join(', ')}${missingAltCount > 3 ? ` and ${missingAltCount - 3} more` : ''}`,
      selector: 'img:not([alt])',
      recommendation: 'Add descriptive alt text to all informational images (e.g. alt="Team collaborating around whiteboard"). For purely decorative images, explicitly specify alt="".'
    });
  } else {
    findings.push({
      id: 'seo-img-alt-passed',
      category: 'seo',
      severity: 'passed',
      title: 'All images contain alt attributes',
      description: `All ${totalImages} image elements on the page include an alt attribute.`,
      evidence: `${totalImages} / ${totalImages} images validated`,
      selector: 'img',
      recommendation: 'No action needed.'
    });
  }

  // 7. HTML Lang Attribute
  const htmlLang = $('html').attr('lang')?.trim();
  if (!htmlLang) {
    findings.push({
      id: 'seo-html-lang-missing',
      category: 'seo',
      severity: 'warning',
      title: 'Missing lang attribute on <html> element',
      description: 'The root <html> element does not specify a language attribute. Specifying language helps search engines target the correct locale and enables screen readers to use proper pronunciation.',
      evidence: '<html> tag lacks lang="..." attribute',
      selector: 'html',
      recommendation: 'Add a language code to the html tag, such as <html lang="en">.'
    });
  } else {
    findings.push({
      id: 'seo-html-lang-passed',
      category: 'seo',
      severity: 'passed',
      title: 'HTML language attribute is defined',
      description: `The document language is properly declared as "${htmlLang}".`,
      evidence: `<html lang="${htmlLang}">`,
      selector: 'html',
      recommendation: 'No action needed.'
    });
  }

  // 8. Open Graph & Social Metadata (Bonus SEO)
  const ogTitle = $('meta[property="og:title" i]').attr('content');
  const ogImage = $('meta[property="og:image" i]').attr('content');

  if (!ogTitle || !ogImage) {
    findings.push({
      id: 'seo-og-tags-missing',
      category: 'seo',
      severity: 'info',
      title: 'Social share metadata (Open Graph) incomplete',
      description: 'Open Graph meta tags (og:title, og:image) enhance how your link looks when shared on social networks and messaging apps.',
      evidence: `Found og:title: ${ogTitle ? 'Yes' : 'No'}, og:image: ${ogImage ? 'Yes' : 'No'}`,
      selector: 'head',
      recommendation: 'Include <meta property="og:title" ...> and <meta property="og:image" ...> for rich link previews.'
    });
  }

  return {
    findings,
    meta: {
      pageTitle: titleText,
      canonical: canonicalHref,
      headingsCount: { h1: h1Count, h2: h2Count, h3: h3Count },
      imagesCount: { total: totalImages, missingAlt: missingAltCount },
    }
  };
}
