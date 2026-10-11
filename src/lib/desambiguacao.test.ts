import { describe, it, expect } from "vitest";
import { avaliar, tokens } from "./desambiguacao";

const alvo = { toksNome: tokens("Padaria Estrela"), toksRazao: tokens("Padaria Estrela Ltda"), municipio: "Campinas", uf: "SP", cnpj: "12345678000190" };

describe("desambiguação de homônimos", () => {
  it("homônimo de outra cidade não é verificado", () => {
    expect(avaliar("Padaria Estrela - Curitiba/PR instagram", alvo).verificado).toBe(false);
  });
  it("mesmo nome na cidade do CNPJ é verificado", () => {
    expect(avaliar("Padaria Estrela | Campinas - SP", alvo).verificado).toBe(true);
  });
  it("só o nome, sem cidade nem CNPJ, não é verificado", () => {
    expect(avaliar("Padaria Estrela instagram", alvo).verificado).toBe(false);
  });
  it("perfil linkado no site oficial é verificado", () => {
    expect(avaliar("Padaria Estrela", alvo, { linkadoNoSite: true }).verificado).toBe(true);
  });
});
