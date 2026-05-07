/**
 * AI 대시보드용 더미 데이터 생성 스크립트
 * 
 * DemandForecasts, OrderRecommendations, SalesAnomalies 테이블에
 * AI 분석 결과 데이터를 생성합니다.
 * 
 * 실제 운영에서는 Python ML 배치 스크립트가 주기적으로 실행하여 데이터를 갱신합니다.
 * 이 스크립트는 PoC용 더미 데이터 생성 목적입니다.
 * 
 * 실행: node scripts/generate-ai-dashboard-data.js
 */

const fs = require('fs');
const path = require('path');
const dataDir = path.join(__dirname, '..', 'db', 'data');

const storeIds = [
  'd1000001-0001-4000-8000-000000000001',
  'd1000001-0002-4000-8000-000000000002',
  'd1000001-0003-4000-8000-000000000003',
  'd1000001-0004-4000-8000-000000000004',
  'd1000001-0005-4000-8000-000000000005',
];
const productIds = [
  'b1000001-0001-4000-8000-000000000001',
  'b1000001-0002-4000-8000-000000000002',
  'b1000001-0003-4000-8000-000000000003',
  'b1000001-0004-4000-8000-000000000004',
  'b1000001-0005-4000-8000-000000000005',
];
const supplierIds = [
  'e1000001-0001-4000-8000-000000000001',
  'e1000001-0002-4000-8000-000000000002',
  'e1000001-0003-4000-8000-000000000003',
  'e1000001-0004-4000-8000-000000000004',
  'e1000001-0005-4000-8000-000000000005',
];

const productProfiles = [
  { baseQty: 25, unitPrice: 20000, costRate: 0.65 },
  { baseQty: 20, unitPrice: 18000, costRate: 0.65 },
  { baseQty: 15, unitPrice: 22000, costRate: 0.60 },
  { baseQty: 10, unitPrice: 25000, costRate: 0.62 },
  { baseQty: 12, unitPrice: 15000, costRate: 0.68 },
];
const storeScales = [1.5, 1.2, 1.3, 1.0, 1.1];

function mkUUID(prefix, num) {
  return prefix + '-' + String(Math.floor(num / 10000)).padStart(4, '0') + '-4000-8000-' + String(num).padStart(12, '0');
}
function formatDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function formatTS(d) { return d.toISOString().slice(0,23) + 'Z'; }
function randInt(min, max) { return Math.floor(Math.random()*(max-min+1))+min; }
function gauss(mean, std) {
  var u = 1-Math.random(), v = Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)*std + mean;
}

var today = new Date(); today.setHours(0,0,0,0);
console.log('🤖 AI Dashboard Data Generator');
console.log('Date: ' + formatDate(today));

// === 1. DemandForecasts (175건) ===
var fRows = [], fIdx = 0;
for (var d = 1; d <= 7; d++) {
  var fd = new Date(today); fd.setDate(fd.getDate()+d);
  var wf = (fd.getDay()===0||fd.getDay()===6) ? 1.25 : 1.0;
  for (var s = 0; s < 5; s++) {
    for (var p = 0; p < 5; p++) {
      fIdx++;
      var pf = productProfiles[p], sc = storeScales[s];
      var qty = Math.max(1, Math.round(pf.baseQty*sc*wf*(1+d*0.005) + gauss(0, pf.baseQty*sc*0.1)));
      var lo = Math.max(0, Math.round(qty*(0.75+Math.random()*0.1)));
      var hi = Math.round(qty*(1.15+Math.random()*0.1));
      var acc = (85+Math.random()*10).toFixed(2);
      fRows.push([mkUUID('a8000001',fIdx),formatDate(fd),qty.toFixed(1),lo.toFixed(1),hi.toFixed(1),'Prophet','v2.1',acc,formatTS(today),storeIds[s],productIds[p]].join(','));
    }
  }
}
fs.writeFileSync(path.join(dataDir,'com.inventory-DemandForecasts.csv'),
  'ID,forecastDate,forecastQty,confidenceLow,confidenceHigh,modelName,modelVersion,accuracy,generatedAt,store_ID,product_ID\n'+fRows.join('\n')+'\n');
console.log('DemandForecasts: '+fRows.length);

// === 2. OrderRecommendations (25건) ===
var oRows = [], oIdx = 0;
var pris = [];
for(var x=0;x<5;x++) pris.push('HIGH');
for(var x=0;x<10;x++) pris.push('MEDIUM');
for(var x=0;x<10;x++) pris.push('LOW');
for(var x=pris.length-1;x>0;x--){var j=Math.floor(Math.random()*(x+1));var t=pris[x];pris[x]=pris[j];pris[j]=t;}

for (var i = 0; i < 25; i++) {
  oIdx++;
  var si = i%5, pi = Math.floor(i/5)%5, sui = pi%5;
  var pf = productProfiles[pi], sc = storeScales[si], pri = pris[i];
  var cs = pri==='HIGH'?randInt(5,20):pri==='MEDIUM'?randInt(20,60):randInt(60,100);
  var fd2 = Math.round(pf.baseQty*sc*7*(0.9+Math.random()*0.2));
  var ss = Math.round(pf.baseQty*sc*3);
  var rq = Math.max(10, fd2+ss-cs);
  var lt = randInt(3,14);
  var ec = (rq*pf.unitPrice*pf.costRate).toFixed(2);
  var note = pri==='HIGH'?'AI: 결품 임박 - 즉시 발주 필요':pri==='MEDIUM'?'AI: 재고 부족 예상 - 발주 권장':'AI: 보충 발주 추천';
  oRows.push([mkUUID('a9000001',oIdx),formatDate(today),rq,cs,fd2.toFixed(1),ss,lt,ec,pri,'Pending',note,storeIds[si],productIds[pi],supplierIds[sui]].join(','));
}
fs.writeFileSync(path.join(dataDir,'com.inventory-OrderRecommendations.csv'),
  'ID,recommendDate,recommendedQty,currentStock,forecastDemand,safetyStock,leadTime,estimatedCost,priority,status,note,store_ID,product_ID,supplier_ID\n'+oRows.join('\n')+'\n');
console.log('OrderRecommendations: '+oRows.length);

// === 3. SalesAnomalies (30건) ===
var aRows = [], aIdx = 0;
var metrics = ['revenue','quantity','customerCount','profit'];
var aTypes = ['SPIKE','DROP','SPIKE','DROP','SPIKE'];

for (var i = 0; i < 30; i++) {
  aIdx++;
  var ad = new Date(today); ad.setDate(ad.getDate()-randInt(0,6));
  var si = i%5, pi = Math.floor(i/5)%5;
  var pf = productProfiles[pi], sc = storeScales[si];
  var mn = metrics[i%4], at = aTypes[i%5];
  var ev;
  if(mn==='revenue') ev=pf.baseQty*sc*pf.unitPrice;
  else if(mn==='quantity') ev=pf.baseQty*sc;
  else if(mn==='customerCount') ev=Math.round(pf.baseQty*sc*0.6);
  else ev=pf.baseQty*sc*pf.unitPrice*(1-pf.costRate);
  var av = at==='SPIKE'?Math.round(ev*(1.5+Math.random())):Math.round(ev*(0.2+Math.random()*0.3));
  var dev = av-ev, std = Math.max(1,Math.round(ev*0.15));
  var zs = (dev/std).toFixed(4);
  var sev = Math.abs(parseFloat(zs))>3?'HIGH':Math.abs(parseFloat(zs))>2?'MEDIUM':'LOW';
  aRows.push([mkUUID('b8000001',aIdx),formatDate(ad),mn,av.toFixed(2),ev.toFixed(2),dev.toFixed(2),zs,at,sev,ev.toFixed(2),std.toFixed(2),'ZScore','v1.3',formatTS(today),storeIds[si],productIds[pi]].join(','));
}
fs.writeFileSync(path.join(dataDir,'com.inventory-SalesAnomalies.csv'),
  'ID,salesDate,metricName,actualValue,expectedValue,deviation,zScore,anomalyType,severity,movingAvg,stdDev,modelName,modelVersion,detectedAt,store_ID,product_ID\n'+aRows.join('\n')+'\n');
console.log('SalesAnomalies: '+aRows.length);

console.log('\n✅ AI 대시보드 데이터 생성 완료!');
console.log('   → 실제 운영: Python ML 배치가 매일 새벽 실행하여 갱신');
