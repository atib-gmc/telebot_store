export function isValidGmail(email) {
  // Regex khusus untuk format @gmail.com
  const gmailRegex = /^[a-z0-9](\.?[a-z0-9]){4,29}@gmail\.com$/;

  return gmailRegex.test(email.toLowerCase());
}

// Contoh Penggunaan:
console.log(isValidGmail("ryuzaki.dev@gmail.com")); // true
console.log(isValidGmail("abc@yahoo.com"));          // false (bukan gmail)
console.log(isValidGmail("a.b@gmail.com"));          // false (terlalu pendek)
