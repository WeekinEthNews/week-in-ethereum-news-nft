const fs = require('fs').promises;
const path = require('path');
const MarkdownIt = require('markdown-it');
const cheerio = require('cheerio');

// Initialize markdown parser
const md = new MarkdownIt();

// Directories
const archiveDir = './archive';
const metadataDir = './metadata';

// Month name to number mapping
const monthMap = {
  'january': '01', 'february': '02', 'march': '03', 'april': '04',
  'may': '05', 'june': '06', 'july': '07', 'august': '08',
  'september': '09', 'october': '10', 'november': '11', 'december': '12'
};

// Ensure metadata directory exists
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

// Parse date from filename with month as word and single-digit days
function parseDateFromFilename(filename) {
  const match = filename.match(/week-in-ethereum-news-([a-z]+)-(\d{1,2})-(\d{4})\.md$/i);
  if (!match) return null;
  const [_, monthWord, day, year] = match;
  const month = monthMap[monthWord.toLowerCase()];
  if (!month) return null;
  // Pad single-digit days with a leading zero
  const paddedDay = day.length === 1 ? `0${day}` : day;
  return `${year}-${month}-${paddedDay}`; // YYYY-MM-DD
}

// Generate SVG content as a string (A3 size: 297mm x 420mm)
function generateSVG(issueDate, headings) {
  const svgWidth = '297mm';
  const svgHeight = '420mm';
  let svg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Background
  svg += '<rect width="100%" height="100%" fill="#f0f0f0"/>';
  
  // Title
  const title = `Week in Ethereum News - ${issueDate}`;
  svg += `<text x="50%" y="50mm" font-size="24pt" text-anchor="middle" font-family="Arial">${title}</text>`;
  
  // Headings
  let yPos = 80; // Starting y-position in mm
  const lineHeight = 10; // mm
  for (const heading of headings) {
    svg += `<text x="20mm" y="${yPos}mm" font-size="14pt" font-family="Arial">${escapeXML(heading)}</text>`;
    yPos += lineHeight;
  }
  
  svg += '</svg>';
  return svg;
}

// Escape special XML characters
function escapeXML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Process a single markdown file
async function processFile(filePath, tokenID) {
  try {
    const filename = path.basename(filePath);
    const issueDate = parseDateFromFilename(filename);
    if (!issueDate) {
      console.error(`Invalid filename format: ${filename}`);
      return;
    }

    // Read markdown content
    const markdownContent = await fs.readFile(filePath, 'utf8');
    const html = md.render(markdownContent);
    const $ = cheerio.load(html);
    const headings = $('h1, h2').map((i, el) => $(el).text().trim()).get();

    // Create token directory
    const tokenDir = path.join(metadataDir, tokenID.toString());
    await ensureDir(tokenDir);

    // Generate SVG
    const svgContent = generateSVG(issueDate, headings);
    const svgFileName = filename.replace('.md', '.svg');
    const svgPath = path.join(tokenDir, svgFileName);
    await fs.writeFile(svgPath, svgContent, 'utf8');

    // Generate JSON metadata
    const metadata = {
      name: `Week in Ethereum News - ${issueDate}`,
      description: `NFT for the Week in Ethereum News issue published on ${issueDate}.`,
      image: `ipfs://[CID]/${svgFileName}`, // Placeholder for IPFS CID
      attributes: [
        { trait_type: 'Date', value: issueDate },
        { trait_type: 'Headings', value: headings.length },
        { trait_type: 'Topics', value: headings.join(', ') }
      ]
    };
    const jsonPath = path.join(tokenDir, `${tokenID}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(metadata, null, 2), 'utf8');

    console.log(`Generated NFT #${tokenID} for ${issueDate}`);
  } catch (err) {
    console.error(`Error processing file ${filePath} for tokenID ${tokenID}:`, err);
  }
}

// Process all markdown files
async function generateNFTs() {
  try {
    await ensureDir(metadataDir);
    const files = await fs.readdir(archiveDir);
    const markdownFiles = files.filter(file => file.match(/week-in-ethereum-news-[a-z]+-\d{1,2}-\d{4}\.md$/i));

    console.log(`Found ${markdownFiles.length} markdown files to process.`);

    // Sort files by date for consistent token ID assignment
    markdownFiles.sort((a, b) => {
      const dateA = parseDateFromFilename(a);
      const dateB = parseDateFromFilename(b);
      return dateA.localeCompare(dateB);
    });

    for (let tokenID = 0; tokenID < markdownFiles.length; tokenID++) {
      const filePath = path.join(archiveDir, markdownFiles[tokenID]);
      await processFile(filePath, tokenID);
    }
    console.log(`Completed processing ${markdownFiles.length} NFTs.`);
  } catch (err) {
    console.error('Error in generateNFTs:', err);
  }
}

// Run the script
generateNFTs();