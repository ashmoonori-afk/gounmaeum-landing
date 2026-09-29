// Site values for the 고운마음 landing page. Unset (null) values are not rendered.
export const SITE_CONFIG = Object.freeze({
  openLabel: null,
  showOperatorLine: true,

  // Public company facts from the operator's website footer (iriscorp.co.kr).
  operatorName: '아이리스',
  bizNo: '572-86-02259',
  ceo: '김종근',
  address: '서울특별시 강남구 강남대로 500, 5F',
  phone: '1588-6764',
  copyrightHolder: 'IRIS Corporation',

  privacyPolicyUrl: null,
  termsUrl: null,
  privacyRetention: null,
  formEndpoint: null,
});

/** True when a config value has been supplied. */
export const isSet = (value) => typeof value === 'string' ? value.trim().length > 0 : value != null;
