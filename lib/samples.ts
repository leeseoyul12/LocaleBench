import type { Project, Entry } from "./domain";
export const sampleEntries: Entry[] = [
  {
    key: "checkout.buy",
    source: "Buy now",
    component: "button",
    translations: {
      de: "Jetzt kostenpflichtig bestellen",
      fr: "Acheter maintenant",
      ko: "지금 구매하기",
    },
  },
  {
    key: "account.greeting",
    source: "Hello, {name}",
    component: "label",
    translations: { de: "Hallo, {name}", fr: "Bonjour, {name}", ko: "안녕하세요, {name}" },
  },
  {
    key: "cart.items",
    source: "{count} items in your cart",
    component: "banner",
    translations: {
      de: "{count} Artikel in Ihrem Warenkorb",
      fr: "{count} articles dans votre panier",
      ko: "장바구니에 {count}개 상품",
    },
  },
  {
    key: "settings.save",
    source: "Save changes",
    component: "button",
    translations: {
      de: "Änderungen speichern",
      fr: "Enregistrer les modifications",
      ko: "변경 사항 저장",
    },
  },
  {
    key: "navigation.overview",
    source: "Overview",
    component: "label",
    translations: { de: "Übersicht", fr: "Vue d’ensemble", ko: "개요" },
  },
  {
    key: "account.invite",
    source: "Invite %s",
    component: "button",
    translations: { de: "%s einladen", fr: "Inviter %s", ko: "%s 초대" },
  },
  {
    key: "notification.success",
    source: "Your changes have been saved",
    component: "banner",
    translations: {
      de: "Ihre Änderungen wurden erfolgreich gespeichert",
      fr: "Vos modifications ont été enregistrées",
      ko: "변경 사항이 저장되었습니다",
    },
  },
  {
    key: "profile.owner",
    source: "{name}'s workspace",
    component: "label",
    translations: {
      de: "Arbeitsbereich von {name}",
      fr: "Espace de travail de {name}",
      ko: "{name}님의 작업공간",
    },
  },
  {
    key: "action.cancel",
    source: "Cancel",
    component: "button",
    translations: { de: "Abbrechen", fr: "Annuler", ko: "취소" },
  },
  {
    key: "offer.discount",
    source: "Save 20%% today",
    component: "banner",
    translations: {
      de: "Heute 20%% sparen",
      fr: "Économisez 20%% aujourd’hui",
      ko: "오늘 20%% 할인",
    },
  },
];
export function createProject(name = "Checkout · 다국어 QA", demo = true): Project {
  return {
    id: crypto.randomUUID(),
    name,
    sourceLocale: "en",
    entries: demo ? structuredClone(sampleEntries) : [],
    conditions: {
      widths: [100, 160, 240],
      fonts: ["Bench Sans", "Bench Mono"],
      fontSize: 14,
      padding: 12,
      scenario: "normal",
      variables: {},
    },
    revision: 1,
    runs: [],
    updatedAt: new Date().toISOString(),
    origin: demo ? "demo" : "manual",
    reviewed: [],
  };
}
