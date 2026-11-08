import linksRaw from '../../config/links.json';
import contactsRaw from '../../config/contacts.json';
import keywordsRaw from '../../config/keywords.json';
import sellerRaw from '../../config/seller.json';
import guidesRaw from '../../config/guides.json';

export interface LinkDef {
  key: string;
  name: string;
  url: string;
  template?: string; // {{url}} / {{q}} / {{domain}}
  guides: string[];
  how?: string;
  pc?: boolean;
  official?: boolean;
  paramHint?: 'domain' | 'url' | 'q';
}
export interface LinksConfig { asOf: string; note: string; links: LinkDef[] }
export const links = linksRaw as LinksConfig;
export const linkByKey = (key: string): LinkDef | undefined => links.links.find((l) => l.key === key);
export const linksForGuide = (guideId: string): LinkDef[] => links.links.filter((l) => l.guides.includes(guideId));

export interface ContactDef { name: string; tel: string; note?: string; altTel?: string }
export interface ContactsConfig {
  asOf: string;
  note: string;
  contacts: ContactDef[];
  lawyer: { note: string; links: { name: string; url: string }[] };
}
export const contacts = contactsRaw as ContactsConfig;

export interface KeywordRule {
  itemId: string;
  suggest: 'red' | 'yellow';
  words?: string[];
  patterns?: string[];
  note?: string;
}
export interface KeywordsConfig {
  asOf: string;
  note: string;
  rules: KeywordRule[];
  celebrityRule: { itemId: string; suggest: 'red' | 'yellow'; note: string };
  payeeRule: { itemId: string; suggest: 'red' | 'yellow'; note: string; corporateMarkers: string[] };
}
export const keywords = keywordsRaw as KeywordsConfig;

export interface SellerConfig {
  asOf: string;
  note: string;
  appName: string;
  appVersion: string;
  sourceTitle: string;
  seller: {
    name: string;
    representative: string;
    address: string;
    registrationNo: string;
    businessType: string;
    association: string;
    contact: string;
    price: string;
  };
}
export const seller = sellerRaw as SellerConfig;
export const sellerIncomplete = (): boolean => Object.values(seller.seller).some((v) => !String(v ?? '').trim());

export interface GuideDef { id: string; title: string; intro: string; steps: string[]; tips: string[]; linkKeys: string[] }
export interface GuidesConfig { asOf: string; guides: GuideDef[] }
export const guides = guidesRaw as GuidesConfig;
export const guideById = (id: string): GuideDef | undefined => guides.guides.find((g) => g.id === id);
