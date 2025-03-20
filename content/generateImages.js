const fs = require('fs').promises;
const path = require('path');
const MarkdownIt = require('markdown-it');
const cheerio = require('cheerio');

const md = new MarkdownIt();
const archiveDir = './archive';
const imagesDir = './images';

const monthMap = {
  'january': '01', 'february': '02', 'march': '03', 'april': '04',
  'may': '05', 'june': '06', 'july': '07', 'august': '08',
  'september': '09', 'october': '10', 'november': '11', 'december': '12'
};
const monthNameMap = Object.fromEntries(
  Object.entries(monthMap).map(([name, num]) => [num, name.charAt(0).toUpperCase() + name.slice(1)])
);

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

function parseDateFromFilename(filename) {
  const match = filename.match(/week-in-ethereum-news-([a-z]+)-(\d{1,2})-(\d{4})\.md$/i);
  if (!match) return null;
  const [_, monthWord, day, year] = match;
  const month = monthMap[monthWord.toLowerCase()];
  if (!month) return null;
  const paddedDay = day.padStart(2, '0');
  return `${year}-${month}-${paddedDay}`;
}

function formatDisplayDate(issueDate) {
  const [year, monthNum, day] = issueDate.split('-');
  const monthName = monthNameMap[monthNum];
  return `${monthName} ${parseInt(day)}, ${year}`;
}

function escapeXML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateSVG(issueDate, markdownContent) {
  const svgWidth = 500;
  const contentHeight = 626;
  let yPos = 50;
  const lineHeight = 12;
  const marginLeft = 42;
  const maxWidth = 436;
  const charsPerLine = Math.floor(maxWidth / 6);
  const maxY = contentHeight;

  let svg = `<svg width="${svgWidth}" height="706" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="20" y="20" width="460" height="666" rx="20" fill="#454A75"/>`;

  // Process markdown
  let cleanedContent = markdownContent.replace(/^---[\s\S]*?---\n*/m, '');
  const html = md.render(cleanedContent);
  const $ = cheerio.load(html);

  const formattedDate = formatDisplayDate(issueDate);
  $('h1').first().filter((i, el) => $(el).text().includes('Week in Ethereum News')).remove();

  const renderedText = new Set();

  const processElement = (el) => {
    let fontSize = 8;
    let xOffset = marginLeft;
    let prefix = '';

    switch (el.tagName) {
      case 'h2':
        fontSize = 12;
        break;
      case 'h3':
        fontSize = 10;
        break;
      case 'li':
        prefix = '* ';
        xOffset = 50;
        break;
      case 'p':
        xOffset = 50;
        break;
    }

    const textLines = [];
    const processNode = (node) => {
      if (node.type === 'text') {
        return [{ text: node.data.trim(), bold: false, underline: false }];
      }
      if (node.type === 'tag') {
        const parts = [];
        const isBold = node.name === 'strong';
        const isUnderline = node.name === 'a';
        $(node).contents().each((_, child) => {
          parts.push(...processNode(child).map(part => ({
            ...part,
            bold: part.bold || isBold,
            underline: part.underline || isUnderline
          })));
        });
        return parts;
      }
      return [];
    };

    const parts = processNode(el);
    if (!parts.length) {
      const text = $(el).text().trim();
      if (text) parts.push({ text, bold: false, underline: false });
    }

    if (prefix && parts.length) parts[0].text = prefix + parts[0].text;

    let currentLine = '';
    for (const part of parts) {
      const words = part.text.split(/\s+/);
      for (const word of words) {
        if (word.length > charsPerLine) {
          if (currentLine) textLines.push(currentLine.trim());
          const chunks = word.match(new RegExp(`.{1,${charsPerLine}}`, 'g'));
          textLines.push(...chunks);
          currentLine = '';
        } else if ((currentLine + word).length > charsPerLine) {
          textLines.push(currentLine.trim());
          currentLine = word + ' ';
        } else {
          currentLine += word + ' ';
        }
      }
    }
    if (currentLine) textLines.push(currentLine.trim());

    textLines.forEach((line, i) => {
      if (yPos + lineHeight > maxY) return;
      const styles = [];
      if (parts[0].bold) styles.push('font-weight="bold"');
      if (parts[0].underline) styles.push('text-decoration="underline"');
      svg += `<text x="${xOffset}" y="${yPos}" font-size="${fontSize}" font-family="Courier New" fill="#ffffff" opacity="0.15" ${styles.join(' ')}>${escapeXML(line)}</text>`;
      yPos += lineHeight;
    });
  };

  $('h2, h3, p, li').each((_, el) => {
    if (yPos < maxY) processElement(el);
  });

  // Date in center
  const centerX = svgWidth / 2;
  const centerY = 706 / 2;
  const dateParts = formattedDate.split(', ');
  svg += `<text fill="#ffffff" font-family="Calibri" font-size="70" font-weight="300" text-anchor="middle">`;
  svg += `<tspan x="${centerX}" y="${centerY - 35}">${dateParts[0]},</tspan>`;
  svg += `<tspan x="${centerX}" y="${centerY + 35}">${dateParts[1]}</tspan>`;
  svg += `</text>`;

  // Footer with corrected Ethereum logo
  svg += `
    <g transform="translate(20, 300) scale(0.8)">
      <path d="m64.496 411-.317 1.076v31.228l.317.316 14.495-8.568L64.496 411Z" stroke="#fff" stroke-width=".866" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M64.496 411 50 435.052l14.496 8.568V411Zm0 35.365-.179.218v11.124l.179.521L79 437.801l-14.504 8.564Z" stroke="#fff" stroke-width=".866" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M64.496 458.228v-11.863L50 437.801l14.496 20.427Zm0-14.608 14.495-8.568-14.495-6.589v15.157ZM50 435.052l14.496 8.568v-15.157L50 435.052Z" stroke="#fff" stroke-width=".866" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </g>
    <text fill="#ffffff" font-family="Calibri" font-size="36" x="88.195" y="660">Week in Ethereum News</text>
  `;

  svg += '</svg>';
  return svg;
}

async function processImage(filePath, tokenID) {
  try {
    const filename = path.basename(filePath);
    const issueDate = parseDateFromFilename(filename);
    if (!issueDate) throw new Error(`Invalid filename format: ${filename}`);

    const markdownContent = await fs.readFile(filePath, 'utf8');
    await ensureDir(imagesDir);
    
    const svgContent = generateSVG(issueDate, markdownContent);
    const svgPath = path.join(imagesDir, filename.replace('.md', '.svg'));
    await fs.writeFile(svgPath, svgContent);
    
    console.log(`Generated image #${tokenID} for ${issueDate}`);
  } catch (err) {
    console.error(`Error processing ${filePath} (tokenID ${tokenID}):`, err);
  }
}

async function generateImages() {
  try {
    await ensureDir(imagesDir);
    const files = await fs.readdir(archiveDir);
    const markdownFiles = files.filter(file => file.match(/week-in-ethereum-news-[a-z]+-\d{1,2}-\d{4}\.md$/i));
    
    markdownFiles.sort((a, b) => parseDateFromFilename(a).localeCompare(parseDateFromFilename(b)));
    
    // Process in batches for better performance
    const batchSize = 10;
    for (let i = 0; i < markdownFiles.length; i += batchSize) {
      const batch = markdownFiles.slice(i, i + batchSize);
      await Promise.all(batch.map((file, idx) => 
        processImage(path.join(archiveDir, file), i + idx + 1)
      ));
    }
    
    console.log(`Completed generating ${markdownFiles.length} images`);
  } catch (err) {
    console.error('Error in generateImages:', err);
  }
}

generateImages();