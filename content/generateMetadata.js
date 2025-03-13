const fs = require('fs').promises;
const path = require('path');

// Directories
const archiveDir = './archive';
const metadataDir = './metadata';

// Month name mappings
const monthMap = {
  'january': '01', 'february': '02', 'march': '03', 'april': '04',
  'may': '05', 'june': '06', 'july': '07', 'august': '08',
  'september': '09', 'october': '10', 'november': '11', 'december': '12'
};
const monthNameMap = Object.fromEntries(
  Object.entries(monthMap).map(([name, num]) => [num, name.charAt(0).toUpperCase() + name.slice(1)])
);

// Ensure directory exists
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

// Parse date from filename
function parseDateFromFilename(filename) {
  const match = filename.match(/week-in-ethereum-news-([a-z]+)-(\d{1,2})-(\d{4})\.md$/i);
  if (!match) return null;
  const [_, monthWord, day, year] = match;
  const month = monthMap[monthWord.toLowerCase()];
  if (!month) return null;
  const paddedDay = day.length === 1 ? `0${day}` : day;
  return `${year}-${month}-${paddedDay}`;
}

// Format dates
function formatDisplayDate(issueDate) {
  const [year, monthNum, day] = issueDate.split('-');
  const monthName = monthNameMap[monthNum];
  const displayDay = parseInt(day, 10);
  return `${monthName} ${displayDay} ${year}`;
}

function formatDescriptionDate(issueDate) {
  const [year, monthNum, day] = issueDate.split('-');
  const monthName = monthNameMap[monthNum];
  const displayDay = parseInt(day, 10);
  return `${monthName} ${displayDay}, ${year}`;
}

// Convert to Unix timestamp
function toUnixTimestamp(issueDate) {
  return Math.floor(new Date(issueDate).getTime() / 1000);
}

// Process a single markdown file for metadata
async function processMetadata(filePath, tokenID) {
  try {
    const filename = path.basename(filePath);
    const issueDate = parseDateFromFilename(filename);
    if (!issueDate) {
      console.error(`Invalid filename format: ${filename}`);
      return;
    }

    const year = issueDate.split('-')[0];
    const issueName = filename.replace('.md', '');
    const svgFileName = filename.replace('.md', '.svg');

    // Ensure metadata directory exists
    await ensureDir(metadataDir);

    // Generate JSON metadata
    const metadata = {
      name: `Week in Ethereum News - ${formatDisplayDate(issueDate)}`,
      description: `Week in Ethereum News, weekly newsletter published between August 2016 and December 2024 by Evan Van Ness. This issue was published on ${formatDescriptionDate(issueDate)}.`,
      image: `ipfs://[CID]/${svgFileName}`, // Placeholder for IPFS CID
      external_url: `https://weekinethereumnews.com/${issueName}`,
      attributes: [
        { trait_type: 'Published', value: toUnixTimestamp(issueDate), display_type: 'date' },
        { trait_type: 'Year', value: year }
      ]
    };
    const jsonPath = path.join(metadataDir, `${tokenID}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(metadata, null, 2), 'utf8');

    console.log(`Generated metadata #${tokenID} for ${issueDate}`);
  } catch (err) {
    console.error(`Error processing metadata for ${filePath} with tokenID ${tokenID}:`, err);
  }
}

// Generate all metadata
async function generateMetadata() {
  try {
    await ensureDir(metadataDir);
    const files = await fs.readdir(archiveDir);
    const markdownFiles = files.filter(file => file.match(/week-in-ethereum-news-[a-z]+-\d{1,2}-\d{4}\.md$/i));

    console.log(`Found ${markdownFiles.length} markdown files to process for metadata.`);

    markdownFiles.sort((a, b) => {
      const dateA = parseDateFromFilename(a);
      const dateB = parseDateFromFilename(b);
      return dateA.localeCompare(dateB);
    });

    for (let tokenID = 1; tokenID <= markdownFiles.length; tokenID++) {
      const fileIndex = tokenID - 1;
      const filePath = path.join(archiveDir, markdownFiles[fileIndex]);
      await processMetadata(filePath, tokenID);
    }
    console.log(`Completed generating metadata for ${markdownFiles.length} NFTs.`);
  } catch (err) {
    console.error('Error in generateMetadata:', err);
  }
}

// Run the script
generateMetadata();