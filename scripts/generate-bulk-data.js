const fs = require('fs');

// ── helpers ──
function mkUUID(prefix, num) {
  // UUID format: 8-4-4-4-12 = 36 chars total
  return prefix + '-0000-4000-8000-' + String(num).padStart(12, '0');
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randDec(min, max, dp = 2) { return (Math.random() * (max - min) + min).toFixed(dp); }
function pad(n, w) { return String(n).padStart(w, '0'); }
function randDate(y1, m1, d1, y2, m2, d2) {
  const s = new Date(y1, m1 - 1, d1).getTime();
  const e = new Date(y2, m2 - 1, d2).getTime();
  const d = new Date(s + Math.random() * (e - s));
  return d.toISOString().slice(0, 10);
}
function randDateTime(y1, m1, d1, y2, m2, d2) {
  const s = new Date(y1, m1 - 1, d1).getTime();
  const e = new Date(y2, m2 - 1, d2).getTime();
  const d = new Date(s + Math.random() * (e - s));
  return d.toISOString().replace(/\.\d+Z$/, 'Z');
}

// ── reference data ──
const storeIds = [1,2,3,4,5].map(i => 'd1000001-' + pad(i,4) + '-4000-8000-00000000000' + i);
const productIds = Array.from({length:100}, (_,i) => "b1000001-" + pad(i+1,4) + "-4000-8000-" + pad(i+1,12));

// ── Korean name data ──
const lastNames = ['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','류','전','홍','고','문','양','손','배','백','허','유','남','심','노','하','곽','성','차','주','우','구','민','진','나','엄','원','천','방','공','현','함'];
const firstNames = ['민수','서연','지훈','수빈','준호','하은','도윤','채원','시우','지아','현우','예은','승민','다은','우진','소윤','태민','하린','건우','수아','재현','유진','동현','미래','성훈','은서','민준','지원','정우','나연','재민','주원','승우','윤아','한결','채린','현준','서윤','태양','은지','민호','다인','진우','예린','상우','하영','규민','소연','형준','보라'];
const cities = [
  {city:'서울',districts:['강남구','서초구','마포구','종로구','송파구','영등포구','용산구','강서구','동작구','관악구','성북구','노원구']},
  {city:'부산',districts:['해운대구','수영구','남구','동래구','부산진구','사하구','연제구','금정구']},
  {city:'대구',districts:['수성구','달서구','중구','북구','동구','남구']},
  {city:'인천',districts:['연수구','남동구','부평구','서구','미추홀구','계양구']},
  {city:'대전',districts:['유성구','서구','중구','동구','대덕구']},
  {city:'광주',districts:['서구','북구','남구','동구','광산구']},
  {city:'수원',districts:['영통구','팔달구','장안구','권선구']},
  {city:'성남',districts:['분당구','수정구','중원구']},
  {city:'고양',districts:['일산동구','일산서구','덕양구']},
  {city:'용인',districts:['수지구','기흥구','처인구']},
];
const streets = ['대로','로','길','번길'];
const emailDomains = ['gmail.com','naver.com','daum.net','kakao.com','hanmail.net'];
const membershipTypes = ['REGULAR','REGULAR','REGULAR','SILVER','SILVER','GOLD','VIP'];
const paymentMethods = ['카드','카드','카드','현금','간편결제','간편결제','포인트'];
const genders = ['M','F'];

function getAgeGroup(birthYear) {
  const age = 2026 - birthYear;
  if (age < 20) return '10대';
  if (age < 30) return '20대';
  if (age < 40) return '30대';
  if (age < 50) return '40대';
  if (age < 60) return '50대';
  return '60대+';
}

function romanize(name) {
  const map = {'김':'kim','이':'lee','박':'park','최':'choi','정':'jung','강':'kang','조':'cho','윤':'yoon','장':'jang','임':'lim','한':'han','오':'oh','서':'seo','신':'shin','권':'kwon','황':'hwang','안':'ahn','송':'song','류':'ryu','전':'jeon','홍':'hong','고':'ko','문':'moon','양':'yang','손':'son','배':'bae','백':'baek','허':'heo','유':'yoo','남':'nam','심':'sim','노':'noh','하':'ha','곽':'kwak','성':'sung','차':'cha','주':'joo','우':'woo','구':'goo','민':'min','진':'jin','나':'na','엄':'um','원':'won','천':'cheon','방':'bang','공':'gong','현':'hyun','함':'ham'};
  return map[name] || 'user';
}

// ═══════════════════════════════════════════════════════════════
// 1. CUSTOMERS (500건)
// ═══════════════════════════════════════════════════════════════
console.log('Generating Customers...');
const customers = [];
const customerIds = [];

for (let i = 1; i <= 500; i++) {
  const id = mkUUID('f1000001', i);
  customerIds.push(id);
  const ln = pick(lastNames);
  const fn = pick(firstNames);
  const name = ln + fn;
  const gender = pick(genders);
  const birthYear = randInt(1960, 2005);
  const birthMonth = randInt(1, 12);
  const birthDay = randInt(1, 28);
  const birthDate = `${birthYear}-${pad(birthMonth,2)}-${pad(birthDay,2)}`;
  const ageGroup = getAgeGroup(birthYear);
  const cityData = pick(cities);
  const district = pick(cityData.districts);
  const streetNum = randInt(1, 300);
  const address = `${district} ${pick(['테헤란','중앙','해방','번영','문화','청춘','희망','미래','산업','학원'])}${pick(streets)} ${streetNum}`;
  const postalCode = pad(randInt(10000, 63999), 5);
  const phone = `010-${pad(randInt(1000,9999),4)}-${pad(randInt(1000,9999),4)}`;
  const romanLn = romanize(ln);
  const email = `${romanLn}${fn.length > 0 ? i : ''}@${pick(emailDomains)}`;
  const membership = pick(membershipTypes);
  const regYear = randInt(2020, 2025);
  const registeredAt = `${regYear}-${pad(randInt(1,12),2)}-${pad(randInt(1,28),2)}`;
  const storeId = pick(storeIds);
  const visitCount = randInt(1, 120);
  const totalPurchaseAmount = randInt(50000, 10000000);
  const lastVisitDate = randDate(2026, 3, 1, 2026, 4, 16);

  customers.push([
    id,
    `CUST-${pad(i,5)}`,
    name,
    phone,
    email,
    gender,
    birthDate,
    ageGroup,
    address,
    cityData.city,
    postalCode,
    membership,
    registeredAt,
    'true',
    totalPurchaseAmount,
    visitCount,
    lastVisitDate,
    storeId
  ].join(','));
}

const custHeader = 'ID,customerCode,name,phone,email,gender,birthDate,ageGroup,address,city,postalCode,membershipType,registeredAt,isActive,totalPurchaseAmount,visitCount,lastVisitDate,preferredStore_ID';
fs.writeFileSync('db/data/com.inventory-Customers.csv', custHeader + '\n' + customers.join('\n') + '\n');
console.log(`  Customers: ${customers.length} rows`);

// ═══════════════════════════════════════════════════════════════
// 2. CUSTOMER PURCHASES (고객당 10~20건 → 총 5,000~10,000건)
// ═══════════════════════════════════════════════════════════════
console.log('Generating CustomerPurchases...');
const purchases = [];
const purchaseIds = [];
let purchaseIdx = 0;

for (let c = 0; c < customerIds.length; c++) {
  const customerId = customerIds[c];
  const numPurchases = randInt(10, 20); // 고객당 10~20건
  for (let p = 0; p < numPurchases; p++) {
    purchaseIdx++;
    const id = mkUUID('f2000001', purchaseIdx);
    purchaseIds.push({ id, customerId });
    const purchaseDate = randDateTime(2025, 6, 1, 2026, 4, 16);
    const dateStr = purchaseDate.slice(0,10).replace(/-/g, '');
    const purchaseNumber = `CP-${dateStr}-${pad(purchaseIdx,5)}`;
    const storeId = pick(storeIds);
    const totalAmount = randInt(5000, 500000);
    const paymentMethod = pick(paymentMethods);

    purchases.push([
      id,
      purchaseNumber,
      purchaseDate,
      totalAmount,
      paymentMethod,
      '',
      customerId,
      storeId
    ].join(','));
  }
}

const cpHeader = 'ID,purchaseNumber,purchaseDate,totalAmount,paymentMethod,note,customer_ID,store_ID';
fs.writeFileSync('db/data/com.inventory-CustomerPurchases.csv', cpHeader + '\n' + purchases.join('\n') + '\n');
console.log(`  CustomerPurchases: ${purchases.length} rows`);

// ═══════════════════════════════════════════════════════════════
// 3. CUSTOMER PURCHASE ITEMS (~1000건, 구매당 1~3건)
// ═══════════════════════════════════════════════════════════════
console.log('Generating CustomerPurchaseItems...');
const items = [];
let itemIdx = 0;

for (let p = 0; p < purchaseIds.length; p++) {
  const numItems = randInt(1, 3);
  for (let j = 0; j < numItems; j++) {
    itemIdx++;
    const id = mkUUID('f3000001', itemIdx);
    const productId = pick(productIds);
    const quantity = randInt(1, 5);
    const unitPrice = randInt(5000, 50000);
    const discount = Math.random() < 0.2 ? randInt(1000, 5000) : 0;
    const totalPrice = quantity * unitPrice - discount;

    items.push([
      id,
      quantity,
      unitPrice,
      discount,
      totalPrice,
      purchaseIds[p].id,
      productId
    ].join(','));
  }
}

const ciHeader = 'ID,quantity,unitPrice,discount,totalPrice,purchase_ID,product_ID';
fs.writeFileSync('db/data/com.inventory-CustomerPurchaseItems.csv', ciHeader + '\n' + items.join('\n') + '\n');
console.log(`  CustomerPurchaseItems: ${items.length} rows`);

// ═══════════════════════════════════════════════════════════════
// 4. STORE PRODUCTS (유니크 store+product 조합, 최대 500건)
// ═══════════════════════════════════════════════════════════════
console.log("Generating StoreProducts (unique store+product)...");

const spRows = [];
const usedCombos = new Set();
let spIdx = 0;

// 5 stores x 100 products = 500 가능한 조합 중 유니크하게 생성
while (spRows.length < 500 && spRows.length < storeIds.length * productIds.length) {
  const storeId = pick(storeIds);
  const productId = pick(productIds);
  const comboKey = storeId + "|" + productId;
  if (usedCombos.has(comboKey)) continue;
  usedCombos.add(comboKey);
  spIdx++;
  const id = mkUUID("c1000001", spIdx);
  const costPrice = randInt(5000, 40000);
  const sellingPrice = Math.round(costPrice * (1 + Math.random() * 0.8 + 0.1));
  const minStock = randInt(5, 50);
  const maxStock = minStock + randInt(50, 500);
  const displayOrder = randInt(1, 100);
  spRows.push([
    id, storeId, productId, sellingPrice, costPrice, minStock, maxStock, displayOrder, "true"
  ].join(","));
}

const spHeader = "ID,store_ID,product_ID,sellingPrice,costPrice,minStock,maxStock,displayOrder,isActive";
fs.writeFileSync("db/data/com.inventory-StoreProducts.csv", spHeader + "\n" + spRows.join("\n") + "\n");
console.log("  StoreProducts: " + spRows.length + " rows (unique combos)");

console.log('\nDone! All bulk data generated successfully.');