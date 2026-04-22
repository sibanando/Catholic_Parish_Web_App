const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const onesOdia = ['', 'ଏକ', 'ଦୁଇ', 'ତିନି', 'ଚାରି', 'ପାଞ୍ଚ', 'ଛଅ', 'ସାତ', 'ଆଠ', 'ନଅ',
  'ଦଶ', 'ଏଗାର', 'ବାର', 'ତେର', 'ଚଉଦ', 'ପନ୍ଦର', 'ଷୋଳ', 'ସତର', 'ଅଠର', 'ଊଣେଇଶ'];
const tensOdia = ['', '', 'କୋଡ଼ିଏ', 'ତିରିଶ', 'ଚାଳିଶ', 'ପଚାଶ', 'ଷାଠିଏ', 'ସତୁରୀ', 'ଅଶୀ', 'ନବେ'];

function convertChunkEnglish(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convertChunkEnglish(n % 100) : '');
}

export function numberToWordsEnglish(num: number): string {
  if (num === 0) return 'Zero Rupees Only';
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let result = '';
  if (rupees >= 10000000) {
    result += convertChunkEnglish(Math.floor(rupees / 10000000)) + ' Crore ';
    num = rupees % 10000000;
  } else {
    num = rupees;
  }
  if (num >= 100000) {
    result += convertChunkEnglish(Math.floor(num / 100000)) + ' Lakh ';
    num = num % 100000;
  }
  if (num >= 1000) {
    result += convertChunkEnglish(Math.floor(num / 1000)) + ' Thousand ';
    num = num % 1000;
  }
  if (num > 0) {
    result += convertChunkEnglish(num);
  }

  result = result.trim() + ' Rupees';
  if (paise > 0) {
    result += ' and ' + convertChunkEnglish(paise) + ' Paise';
  }
  return result + ' Only';
}

function convertChunkOdia(n: number): string {
  if (n === 0) return '';
  if (n < 20) return onesOdia[n];
  if (n < 100) return tensOdia[Math.floor(n / 10)] + (n % 10 ? ' ' + onesOdia[n % 10] : '');
  return onesOdia[Math.floor(n / 100)] + ' ଶହ' + (n % 100 ? ' ' + convertChunkOdia(n % 100) : '');
}

export function numberToWordsOdia(num: number): string {
  if (num === 0) return 'ଶୂନ୍ୟ ଟଙ୍କା ମାତ୍ର';
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let result = '';
  let remaining = rupees;

  if (remaining >= 10000000) {
    result += convertChunkOdia(Math.floor(remaining / 10000000)) + ' କୋଟି ';
    remaining = remaining % 10000000;
  }
  if (remaining >= 100000) {
    result += convertChunkOdia(Math.floor(remaining / 100000)) + ' ଲକ୍ଷ ';
    remaining = remaining % 100000;
  }
  if (remaining >= 1000) {
    result += convertChunkOdia(Math.floor(remaining / 1000)) + ' ହଜାର ';
    remaining = remaining % 1000;
  }
  if (remaining > 0) {
    result += convertChunkOdia(remaining);
  }

  result = result.trim() + ' ଟଙ୍କା';
  if (paise > 0) {
    result += ' ଏବଂ ' + convertChunkOdia(paise) + ' ପଇସା';
  }
  return result + ' ମାତ୍ର';
}
