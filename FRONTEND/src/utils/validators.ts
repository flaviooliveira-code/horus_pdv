/**
 * Arquivo: src/utils/validators.ts
 * Objetivo: centraliza validações de documento, e-mail e data de nascimento utilizadas nos formulários.
 * Entradas esperadas: recebe strings brutas de campos (CPF/CNPJ/e-mail/data) e retorna flags ou valores derivados.
 */

import { onlyDigits } from "./inputMasks";

// Bloqueia sequências inválidas como 11111111111.
const repeatedDigits = (value: string) => /^(\d)\1+$/.test(value);

export function isValidCpf(rawCpf: string) {
  // Normaliza removendo pontuação para aplicar algoritmo oficial do CPF.
  const cpf = onlyDigits(rawCpf);
  if (cpf.length !== 11 || repeatedDigits(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  return digit === Number(cpf[10]);
}

export function isValidCnpj(rawCnpj: string) {
  // Normaliza removendo pontuação para aplicar algoritmo oficial do CNPJ.
  const cnpj = onlyDigits(rawCnpj);
  if (cnpj.length !== 14 || repeatedDigits(cnpj)) return false;

  const calcDigit = (base: string, factors: number[]) => {
    const sum = base
      .split("")
      .reduce((acc, digit, index) => acc + Number(digit) * factors[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const base12 = cnpj.slice(0, 12);
  const d1 = calcDigit(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcDigit(`${base12}${d1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${d1}${d2}`);
}

export function isValidEmail(email: string) {
  // Campo vazio é tratado como válido para deixar obrigatoriedade a cargo do formulário.
  if (!email.trim()) return true;
  return /\S+@\S+\.\S+/.test(email.trim());
}

export function parseBirthDateBr(rawValue: string) {
  const [day, month, year] = rawValue.split("/").map(Number);
  if (!day || !month || !year) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function getAgeFromBirthDate(rawValue: string) {
  const birthDate = parseBirthDateBr(rawValue);
  if (!birthDate) return null;

  const today = new Date();
  // Calcula idade real considerando se o aniversário já ocorreu no ano corrente.
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) age -= 1;
  if (age < 0 || age > 130) return null;
  return age;
}
