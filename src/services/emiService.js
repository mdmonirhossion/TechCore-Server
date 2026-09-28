export const emiBanksList = [
  { bankCode: 'CITY', bankName: 'City Bank (Amex / Visa / Mastercard)', maxTenureMonths: 12, minAmount: 5000, interestRates: { 3: 0, 6: 0, 9: 4.5, 12: 6.0 } },
  { bankCode: 'EBL', bankName: 'Eastern Bank Ltd (EBL)', maxTenureMonths: 12, minAmount: 5000, interestRates: { 3: 0, 6: 0, 9: 4.0, 12: 5.5 } },
  { bankCode: 'BRAC', bankName: 'BRAC Bank', maxTenureMonths: 12, minAmount: 5000, interestRates: { 3: 0, 6: 0, 9: 4.5, 12: 6.0 } },
  { bankCode: 'DBBL', bankName: 'Dutch-Bangla Bank (DBBL)', maxTenureMonths: 12, minAmount: 5000, interestRates: { 3: 0, 6: 3.5, 9: 5.0, 12: 7.0 } },
  { bankCode: 'SCB', bankName: 'Standard Chartered Bank', maxTenureMonths: 12, minAmount: 10000, interestRates: { 3: 0, 6: 0, 9: 3.5, 12: 5.0 } },
  { bankCode: 'MTB', bankName: 'Mutual Trust Bank (MTB)', maxTenureMonths: 12, minAmount: 5000, interestRates: { 3: 0, 6: 0, 9: 4.0, 12: 6.0 } },
  { bankCode: 'PRIME', bankName: 'Prime Bank', maxTenureMonths: 12, minAmount: 5000, interestRates: { 3: 0, 6: 0, 9: 4.0, 12: 6.0 } },
  { bankCode: 'LANKA', bankName: 'LankaBangla Finance', maxTenureMonths: 12, minAmount: 5000, interestRates: { 3: 0, 6: 0, 9: 4.5, 12: 6.5 } }
];

export function calculateEmiInstallment({ amount, tenureMonths, bankCode = 'CITY' }) {
  const numericAmount = Number(amount) || 0;
  const tenure = parseInt(tenureMonths) || 6;
  const bank = emiBanksList.find(b => b.bankCode === bankCode) || emiBanksList[0];

  const rate = bank.interestRates[tenure] || 0;
  const interestAmount = Math.round((numericAmount * rate) / 100);
  const totalPayable = numericAmount + interestAmount;
  const monthlyInstallment = Math.ceil(totalPayable / tenure);

  return {
    amount: numericAmount,
    tenureMonths: tenure,
    bankName: bank.bankName,
    bankCode: bank.bankCode,
    interestRatePercent: rate,
    interestAmount,
    totalPayable,
    monthlyInstallment
  };
}
