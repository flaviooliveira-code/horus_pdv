/**
 * Arquivo: src/hooks/useInputMasks.ts
 * Objetivo: expõe máscaras de input de forma centralizada para componentes.
 */
import { useMemo } from "react";
import {
  formatMoneyBr,
  hasCurrencyInput,
  maskCellphoneBr,
  maskCep,
  maskCnpj,
  maskCurrencyBr,
  maskCpf,
  maskCpfOrCnpj,
  maskDateBr,
  maskMoneyBr,
  maskPhoneBr,
  maskRg,
  maskTelephoneBr,
  maskTime,
  onlyCnpjChars,
  onlyDigits,
  parseCurrencyBr,
  parseMoneyBr,
  sanitizeDecimalInput,
  sanitizeIntegerInput,
} from "@/utils/inputMasks";

export default function useInputMasks() {
  return useMemo(
    () => ({
      onlyDigits,
      onlyCnpjChars,
      maskCpf,
      maskCnpj,
      maskCpfOrCnpj,
      maskPhoneBr,
      maskTelephoneBr,
      maskCellphoneBr,
      maskCep,
      maskRg,
      maskDateBr,
      maskMoneyBr,
      maskCurrencyBr,
      parseMoneyBr,
      parseCurrencyBr,
      formatMoneyBr,
      hasCurrencyInput,
      maskTime,
      sanitizeIntegerInput,
      sanitizeDecimalInput,
    }),
    [],
  );
}
