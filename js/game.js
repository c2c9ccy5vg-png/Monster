"use strict";
(function(){
try{

// ============================ TYPEN ============================
const TYPE_COLORS={Normal:'#9a9285',Feuer:'#d95b43',Wasser:'#4a7fc1',Pflanze:'#5aa464',
  Elektro:'#d9a92c',Stein:'#8a7f6d',Geist:'#7a5da8',Eis:'#5fb8c9',Gift:'#9a5aa8',
  Kampf:'#c25a3a',Flug:'#8fb4e0',Drache:'#5a4ab0',Metall:'#8a94a8'};
const CHART={
  Normal:{Stein:.5,Metall:.5,Geist:0},
  Feuer:{Pflanze:2,Eis:2,Metall:2,Wasser:.5,Stein:.5,Feuer:.5,Drache:.5},
  Wasser:{Feuer:2,Stein:2,Pflanze:.5,Wasser:.5,Drache:.5},
  Pflanze:{Wasser:2,Stein:2,Feuer:.5,Pflanze:.5,Gift:.5,Eis:.5,Flug:.5,Drache:.5,Metall:.5},
  Elektro:{Wasser:2,Flug:2,Stein:.5,Elektro:.5,Drache:.5,Pflanze:.5},
  Stein:{Feuer:2,Elektro:2,Eis:2,Flug:2,Wasser:.5,Pflanze:.5,Kampf:.5,Metall:.5},
  Geist:{Geist:2,Gift:2,Normal:0},
  Eis:{Pflanze:2,Gift:2,Flug:2,Drache:2,Feuer:.5,Wasser:.5,Stein:.5,Eis:.5,Metall:.5},
  Gift:{Pflanze:2,Stein:.5,Gift:.5,Geist:.5,Metall:0},
  Kampf:{Normal:2,Stein:2,Eis:2,Metall:2,Flug:.5,Geist:.5,Gift:.5},
  Flug:{Pflanze:2,Kampf:2,Elektro:.5,Stein:.5,Metall:.5},
  Drache:{Drache:2,Metall:.5},
  Metall:{Eis:2,Stein:2,Drache:2,Feuer:.5,Wasser:.5,Elektro:.5,Metall:.5}
};
const typeMult=(mt,dt)=>(CHART[mt]&&CHART[mt][dt]!=null)?CHART[mt][dt]:1;
// Wirkung gegen eine Kryptide mit einem ODER zwei Typen
function multVs(moveType,defTypes){
  let v=1;
  defTypes.forEach(t=>{v*=typeMult(moveType,t);});
  return v;
}
// Gedeckelt: Doppelschwäche max. 2.6x, Doppelresistenz min. 0.34x
function softMult(v){
  if(v>2)return 2.6;
  if(v<1)return Math.max(.34,Math.pow(v,.78));
  return v;
}

// ============================ STATUS ============================
const STATUS={
  brand:{name:'Verbrennung',icon:'🔥',color:'#d95b43'},
  gift:{name:'Vergiftung',icon:'☠️',color:'#9a5aa8'},
  laehmung:{name:'Lähmung',icon:'⚡',color:'#d9a92c'},
  frost:{name:'Frost',icon:'❄️',color:'#5fb8c9'}
};

// Beschreibungstext einer Attacke
// Attackenpunkte: starke Attacken sind seltener einsetzbar
function moveAP(m){
  if(m.apOverride!=null)return m.apOverride;
  if(m.kind==='heal')return 5;
  if(!m.power)return 10;
  if(m.power>=26)return 5;
  if(m.power>=20)return 10;
  if(m.power>=14)return 15;
  return 25;
}
// Genauigkeit in Prozent
function moveAcc(m){
  if(m.acc!=null)return m.acc;
  if(m.kind==='status')return Math.round((m.chance||.9)*100);
  if(!m.power)return 100;
  if(m.power>=26)return 85;
  if(m.power>=20)return 90;
  return 100;
}
function moveDesc(m){
  if(!m)return '';
  const st=s=>s==='atk'?'Angriff':s==='def'?'Verteidigung':'Initiative';
  const own=s=>s==='atk'?'den eigenen Angriff':s==='def'?'die eigene Verteidigung':'die eigene Initiative';
  const foe=s=>s==='atk'?'den Angriff':s==='def'?'die Verteidigung':'die Initiative';
  const p=[];
  if(m.kind==='buff')p.push('Erhöht '+own(m.stat)+(m.stages>1?' stark':''));
  else if(m.kind==='debuff')p.push('Senkt '+foe(m.stat)+' des Ziels'+(m.stages>1?' stark':''));
  else if(m.kind==='heal')p.push('Heilt '+Math.round(m.heal*100)+'% der eigenen KP');
  else if(m.kind==='status')p.push('Verursacht '+STATUS[m.status].name+' ('+Math.round(m.chance*100)+'%)');
  else{
    p.push(m.power>=24?'Sehr starker Angriff':m.power>=18?'Starker Angriff':
           m.power>=14?'Solider Angriff':'Schwacher, verlässlicher Angriff');
    if(m.drain)p.push('heilt um '+Math.round(m.drain*100)+'% des Schadens');
    if(m.status)p.push('verursacht '+STATUS[m.status].name+' ('+Math.round(m.chance*100)+'%)');
    if(m.debuff)p.push('senkt '+foe(m.debuff)+' des Ziels');
  }
  const acc=moveAcc(m);
  if(acc<100&&m.kind!=='status')p.push('Genauigkeit '+acc+'%');
  return p.join(' · ');
}

// ============================ FÄHIGKEITEN ============================
const ABILITIES={
  hitzkopf:{name:'Hitzkopf',desc:'Unter 30% KP +40% Schaden'},
  regenerator:{name:'Regenerator',desc:'Heilt jede Runde 6% KP'},
  dornenpanzer:{name:'Dornenpanzer',desc:'Angreifer erleidet 12% zurück'},
  statik:{name:'Statik',desc:'Berührung lähmt manchmal'},
  robust:{name:'Robust',desc:'Übersteht aus voller Gesundheit einen tödlichen Treffer'},
  schwebe:{name:'Schwebe',desc:'25% Chance auszuweichen'},
  eisschild:{name:'Eisschild',desc:'Erleidet 20% weniger Schaden'},
  giftdorn:{name:'Giftdorn',desc:'Berührung vergiftet manchmal'},
  flink:{name:'Flink',desc:'Initiative +25%'},
  felsenfest:{name:'Felsenfest',desc:'Immun gegen Statusprobleme'},
  lebenskraft:{name:'Lebenskraft',desc:'Heilt jede Runde 9% KP'},
  sturmherz:{name:'Sturmherz',desc:'Initiative +35%'},
  seelenraub:{name:'Seelenraub',desc:'Heilt 20% des Schadens'},
  ewigkeit:{name:'Ewigkeit',desc:'Übersteht einen Treffer und heilt'},
  panzerhaut:{name:'Panzerhaut',desc:'Erleidet 20% weniger Schaden'},
  kampfgeist:{name:'Kampfgeist',desc:'Unter 50% KP +25% Schaden'},
  drachenmut:{name:'Drachenmut',desc:'Initiative +20%'}
};
const ABIL_OF={flamko:'hitzkopf',aquappi:'regenerator',blattli:'dornenpanzer',zappzap:'statik',
  brockel:'robust',spuki:'schwebe',frosti:'eisschild',giftling:'giftdorn',flatterix:'flink',
  krabbo:'felsenfest',silvarion:'lebenskraft',voltrex:'sturmherz',umbrakor:'seelenraub',aeternis:'ewigkeit',
  erzling:'panzerhaut',faustli:'kampfgeist',draklin:'drachenmut'};
const abilOf=m=>ABIL_OF[FAMILY_OF[m.id]]||null;
const hasAbil=(m,a)=>abilOf(m)===a;

// ============================ WETTER ============================
const WEATHER={
  regen:{name:'Regen',icon:'🌧️',up:'Wasser',down:'Feuer'},
  sonne:{name:'Sonnenschein',icon:'☀️',up:'Feuer',down:'Wasser'},
  nebel:{name:'Nebel',icon:'🌫️',up:'Geist',down:'Normal'},
  sturm:{name:'Sandsturm',icon:'🌪️',up:'Stein',down:'Pflanze'},
  schnee:{name:'Schneetreiben',icon:'❄️',up:'Eis',down:'Pflanze'}
};

// ============================ ATTACKEN ============================
function M(name,type,power,extra){return Object.assign({name,type,power,kind:'dmg'},extra||{});}
const MOVES={
  // Normal
  rempler:M('Rempler','Normal',10), krallenhieb:M('Krallenhieb','Normal',14),
  kraftschlag:M('Kraftschlag','Normal',19), wuchtstoss:M('Wuchtstoß','Normal',25),
  kampfschrei:{name:'Kampfschrei',type:'Normal',power:0,kind:'buff',stat:'atk',stages:2},
  schild:{name:'Schild',type:'Normal',power:0,kind:'buff',stat:'def',stages:2},
  erholung:{name:'Erholung',type:'Normal',power:0,kind:'heal',heal:.35,apOverride:5},
  einschuechtern:{name:'Einschüchtern',type:'Normal',power:0,kind:'debuff',stat:'atk',stages:2},
  // Feuer
  flammenwurf:M('Flammenwurf','Feuer',15), glutwelle:M('Glutwelle','Feuer',20), infernoklinge:M('Infernoklinge','Feuer',27),
  glutstoss:M('Glutstoß','Feuer',12,{status:'brand',chance:.35}),
  hitzeschild:{name:'Hitzeschild',type:'Feuer',power:0,kind:'buff',stat:'def',stages:2},
  // Wasser
  wasserstrahl:M('Wasserstrahl','Wasser',15), wasserwoge:M('Wasserwoge','Wasser',20), sturmflut:M('Sturmflut','Wasser',27),
  aquaheilung:{name:'Aquaheilung',type:'Wasser',power:0,kind:'heal',heal:.35,apOverride:5},
  nebelstoss:M('Nebelstoß','Wasser',11,{debuff:'spd',stages:1}),
  // Pflanze
  blattschuss:M('Blattschuss','Pflanze',15), blattklinge:M('Blattklinge','Pflanze',20), urwaldzorn:M('Urwaldzorn','Pflanze',27),
  blattsauger:M('Blattsauger','Pflanze',13,{drain:.5}),
  sporennebel:{name:'Sporennebel',type:'Pflanze',power:0,kind:'status',status:'laehmung',chance:.85},
  // Elektro
  blitzschlag:M('Blitzschlag','Elektro',15), donnerschlag:M('Donnerschlag','Elektro',20), gewittersturm:M('Gewittersturm','Elektro',27),
  funkenflug:M('Funkenflug','Elektro',12,{status:'laehmung',chance:.35}),
  donnerwelle:{name:'Donnerwelle',type:'Elektro',power:0,kind:'status',status:'laehmung',chance:.9},
  // Stein
  steinwurf:M('Steinwurf','Stein',15), felslawine:M('Felslawine','Stein',20), bergsturz:M('Bergsturz','Stein',27),
  panzerung:{name:'Panzerung',type:'Stein',power:0,kind:'buff',stat:'def',stages:2},
  steinstaub:M('Steinstaub','Stein',11,{debuff:'atk',stages:1}),
  // Geist
  spukschlag:M('Spukschlag','Geist',15), schattenkralle:M('Schattenkralle','Geist',20), seelenriss:M('Seelenriss','Geist',27),
  fluch:{name:'Fluch',type:'Geist',power:0,kind:'debuff',stat:'atk',stages:2},
  schattenzehr:M('Schattenzehr','Geist',13,{drain:.5}),
  // Eis
  frostbiss:M('Frostbiss','Eis',15), eissturm:M('Eissturm','Eis',20), gletscherbruch:M('Gletscherbruch','Eis',27),
  frosthauch:M('Frosthauch','Eis',12,{status:'frost',chance:.3}),
  eiswind:M('Eiswind','Eis',11,{debuff:'spd',stages:2}),
  // Gift
  // --- Signaturattacken der Legendären ---
  weltenwurzel:M('Weltenwurzel','Pflanze',24,{drain:.35,acc:85,apOverride:5}),
  sturmzorn:M('Sturmzorn','Elektro',25,{status:'laehmung',chance:.3,acc:85,apOverride:5}),
  nachtschlund:M('Nachtschlund','Geist',25,{debuff:'atk',stages:1,acc:85,apOverride:5}),
  ewigkeitsschlag:M('Ewigkeitsschlag','Normal',27,{acc:85,apOverride:5}),
  // --- Kampf ---
  fausthieb:M('Fausthieb','Kampf',14),
  wirbelschlag:M('Wirbelschlag','Kampf',19),
  titanenfaust:M('Titanenfaust','Kampf',26),
  ausholer:{name:'Kampfhaltung',type:'Kampf',power:0,kind:'buff',stat:'atk',stages:2},
  konter:M('Konter','Kampf',12,{debuff:'def',stages:1}),
  // --- Flug ---
  windstoss:M('Windstoß','Flug',14),
  sturmflug:M('Sturmflug','Flug',19),
  orkanschlag:M('Orkanschlag','Flug',26),
  luftwirbel:M('Luftwirbel','Flug',11,{debuff:'spd',stages:2}),
  // --- Drache ---
  drachenklaue:M('Drachenklaue','Drache',15),
  drachenstoss:M('Drachenstoß','Drache',20),
  drachensturm:M('Drachensturm','Drache',27),
  drachentanz:{name:'Drachentanz',type:'Drache',power:0,kind:'buff',stat:'atk',stages:2},
  // --- Metall ---
  metallklaue:M('Metallklaue','Metall',14),
  stahlschlag:M('Stahlschlag','Metall',19),
  erzsturm:M('Erzsturm','Metall',26),
  stahlpanzer:{name:'Stahlpanzer',type:'Metall',power:0,kind:'buff',stat:'def',stages:2},
  // --- Attacken der Schriftrollen ---
  lichtlanze:M('Lichtlanze','Normal',22,{acc:100}),
  sturmruf:{name:'Sturmruf',type:'Flug',power:0,kind:'buff',stat:'spd',stages:2},
  aderlass:M('Aderlass','Geist',20,{drain:.6}),
  urfaust:M('Berserkerschlag','Kampf',27),
  kronenschlag:M('Kronenschlag','Metall',30),
  // ============ Signatur-Attacken: je eine pro Entwicklungsreihe, ab ca. Lv.56 ============
  vulkanherz:M('Vulkanherz','Feuer',28,{debuff:'atk',stages:1}),
  flutkrone:M('Flutkrone','Wasser',28,{debuff:'spd',stages:1}),
  wurzelgericht:M('Wurzelgericht','Pflanze',28,{drain:.3}),
  blitzkaskade:M('Blitzkaskade','Elektro',26,{status:'laehmung',chance:.3}),
  erdbeben:M('Erdbeben','Stein',30),
  seelenschrei:M('Seelenschrei','Geist',28,{debuff:'def',stages:1}),
  frostkrone:M('Frostkrone','Eis',26,{status:'frost',chance:.3}),
  giftkrone:M('Giftkrone','Gift',28,{status:'gift',chance:.3}),
  himmelssturz:M('Himmelssturz','Flug',22,{switchAfter:true,apOverride:8}),
  panzerbrecher:M('Panzerbrecher','Stein',28,{debuff:'def',stages:1}),
  urzeitatem:M('Urzeitatem','Drache',28,{debuff:'def',stages:1}),
  titanschlag:M('Titanschlag','Metall',28,{debuff:'spd',stages:1}),
  finalfaust:M('Finalfaust','Kampf',32),
  sturmkrone:M('Sturmkrone','Flug',28,{debuff:'spd',stages:1}),
  dornengericht:M('Dornengericht','Gift',28,{status:'gift',chance:.3}),
  gipfelsturz:M('Gipfelsturz','Stein',28,{debuff:'atk',stages:1}),
  ueberlastung:M('Überlastung','Elektro',26,{status:'laehmung',chance:.3}),
  ewigerfrost:M('Ewiger Frost','Eis',28,{status:'frost',chance:.3}),
  morgenlicht:M('Morgenlicht','Normal',24,{drain:.4}),
  todesstroemung:M('Tödliche Strömung','Wasser',28,{status:'gift',chance:.3}),
  alphabiss:M('Alphabiss','Kampf',30),
  urgifthauch:M('Urgifthauch','Gift',28,{status:'gift',chance:.35}),
  wuestensturm:M('Wüstensturm','Stein',30),
  neunschweifzorn:M('Neunschweifzorn','Geist',28,{debuff:'def',stages:1}),
  hydragift:M('Hydragift','Gift',28,{status:'gift',chance:.3}),
  dreifachschlag:M('Dreifachschlag','Kampf',30),
  sternengalopp:M('Sternengalopp','Flug',30),
  // ============ Spreiz-Attacken: treffen im Doppelkampf automatisch beide Gegner ============
  schockwelle:M('Schockwelle','Normal',8,{hitsAll:true}),
  kettenblitz:M('Kettenblitz','Elektro',14,{hitsAll:true}),
  frostexplosion:M('Frostexplosion','Eis',14,{hitsAll:true}),
  giftnebel:M('Giftnebel','Gift',12,{hitsAll:true,status:'gift',chance:.25}),
  geroellhagel:M('Geröllhagel','Stein',14,{hitsAll:true}),
  sturmschwinge:M('Sturmklinge','Flug',27,{debuff:'spd',stages:1}),
  urdrache:M('Drachenodem','Drache',27),
  stahlkern:M('Stahlbrecher','Metall',27,{debuff:'def',stages:1}),
  rankengriff:M('Rankengriff','Pflanze',26,{drain:.4}),
  seelenfeuer:M('Seelenfeuer','Geist',26,{debuff:'atk',stages:1}),
  flutwelle:M('Flutwelle','Wasser',26,{debuff:'spd',stages:2}),
  donnerlanze:M('Donnerlanze','Elektro',26,{status:'laehmung',chance:.3}),
  feuersturm:M('Feuersturm','Feuer',26,{status:'brand',chance:.3}),
  giftflut:M('Giftflut','Gift',26,{status:'gift',chance:.35}),
  erdstoss:M('Erdstoß','Stein',26,{debuff:'def',stages:1}),
  frostnova:M('Frostnova','Eis',26,{status:'frost',chance:.28}),
  urgewalt:M('Urgewalt','Normal',29),
  giftstachel:M('Giftstachel','Gift',15), saeurewelle:M('Säurewelle','Gift',20), toxinflut:M('Toxinflut','Gift',27),
  gifthieb:M('Gifthieb','Gift',12,{status:'gift',chance:.4}),
  giftwolke:{name:'Giftwolke',type:'Gift',power:0,kind:'status',status:'gift',chance:.9}
};

// ============================ SPRITES ============================
const SP={
  flamko:{p:{Y:'#f5d34a',R:'#e2543e',O:'#ef8a3c',K:'#2b1d16',W:'#fff'},r:['............','.....Y......','....YRY.....','....RRR.....','...RRRRR....','..OOOOOOO...','..OWKOWKO...','..OOOOOOO...','..OOKKOOO...','...OOOOO....','...O...O....','..OO...OO...']},
  flamkor:{p:{Y:'#f5d34a',R:'#d13a2a',O:'#ef8a3c',K:'#2b1d16',W:'#fff'},r:['..Y......Y..','..RY....YR..','...RRYYRR...','..RRRRRRRR..','.RRRRRRRRRR.','.OWKOOOOWKO.','.OOOOOOOOOO.','.OOKKKKKKOO.','..OOOOOOOO..','..OO....OO..','.OOO....OOO.','............']},
  flamgeddon:{p:{R:'#c8351f',O:'#ef7a2c',Y:'#f5d34a',K:'#2b1d16',W:'#fff'},r:['.R..YY..R...','.RR.YYY.RR..','.RRRRRRRRR..','RROOOOOOORR.','ROOOOOOOOOR.','ROWKOOOWKOR.','ROOOOOOOOOR.','ROOYYYYYOOR.','RROOOOOOORR.','.RO.....OR..','.RR.....RR..','............']},
  aquappi:{p:{B:'#4a7fc1',C:'#8fe0f0',K:'#1e2a4a',W:'#fff'},r:['............','.....C......','....CCC.....','.....C......','..BBBBBBB...','.BBBBBBBBB..','.BWKBBBWKB..','.BBBBBBBBB..','.BBBKKBBBB..','..BBBBBBB...','...BBBBB....','..B.....B...']},
  aquadon:{p:{B:'#3a6cb0',C:'#8fe0f0',K:'#1e2a4a',W:'#fff'},r:['.....CC.....','....CCCC....','C..BBBBBB..C','CC.BBBBBB.CC','.BBWKBBWKBB.','.BBBBBBBBBB.','.BBBKKKKBBB.','..BBBBBBBB..','...BBBBBB...','..BB.BB.BB..','............','............']},
  aquatlas:{p:{B:'#356cb0',C:'#9fe8f8',K:'#12233f',W:'#fff'},r:['..C......C..','..CC....CC..','.CBBBBBBBBC.','CBBBBBBBBBBC','CBBBBBBBBBBC','CBWKBBBBWKBC','CBBBBBBBBBBC','.CBBCCCCBBC.','.CBBBBBBBBC.','..CBB..BBC..','...CC..CC...','............']},
  blattli:{p:{G:'#3c7a46',L:'#86d073',K:'#1e3320',W:'#fff'},r:['.....G......','....GGG.....','.....G......','...LLLLL....','..LLLLLLL...','..LWKLLWK...','..LLLLLLL...','..LLKKLLL...','...LLLLL....','...L...L....','..LL...LL...','............']},
  blattlon:{p:{G:'#2e6338',L:'#74c064',K:'#1e3320',W:'#fff',P:'#f090b0'},r:['..P..PP..P..','...GGGGGG...','..GLLLLLLG..','..LLLLLLLL..','.LLWKLLWKLL.','.LLLLLLLLLL.','.LLLKKKKLLL.','..LLLLLLLL..','..LL....LL..','.LLL....LLL.','............','............']},
  blattgigant:{p:{G:'#2e6338',L:'#74c064',K:'#173318',W:'#fff'},r:['..GGGGGGGG..','.GLLLLLLLLG.','.LLLLLLLLLL.','.LLLLLLLLLL.','.LLWKLLWKLL.','.LLLLLLLLLL.','.LLLGGGGLLL.','.LLLLLLLLLL.','..LLLLLLLL..','..LL....LL..','.LLL....LLL.','............']},
  blattmonarch:{p:{G:'#1e4d28',L:'#8be070',K:'#132818',W:'#fff',P:'#f2d34a'},r:['.PP.GG.PP...','..GGGGGGGG..','.GLLLLLLLLG.','.LLLLLLLLLL.','.LLWKLLWKLL.','.LLLLLLLLLL.','.LLLPPPPLLL.','.LLLLLLLLLL.','..LLLLLLLL..','..LL....LL..','.LLL....LLL.','............']},
  zappzap:{p:{Y:'#f0d240',D:'#c9932c',K:'#3a2c10',W:'#fff'},r:['....D..D....','....YD.DY...','...YYYYYY...','..YYYYYYYY..','..YWKYYWKY..','..YYYYYYYY..','..YYKKYYYY..','...YYYYYY...','....YDDY....','.....YY.....','....Y..Y....','............']},
  zappzorn:{p:{Y:'#eac82e',D:'#a87920',K:'#3a2c10',W:'#fff'},r:['..D.D..D.D..','..YD.YY.DY..','..YYYYYYYY..','.YYYYYYYYYY.','.YWKYYYYWKY.','.YYYYYYYYYY.','.YYYKKKKYYY.','..YYYYYYYY..','...YDYYDY...','....Y..Y....','...YY..YY...','............']},
  zapptitan:{p:{Y:'#eac82e',D:'#a87920',K:'#3a2c10',W:'#fff'},r:['..DY.YY.YD..','..YYYYYYYY..','.YYYYYYYYYY.','.YYYYYYYYYY.','.YWKYYYYWKY.','.YYYYYYYYYY.','.YYYDDDDYYY.','.YYYYYYYYYY.','..YYYYYYYY..','..YD....DY..','...Y....Y...','............']},
  brockel:{p:{S:'#a0937e',D:'#6b6255',K:'#2c281f',W:'#fff'},r:['............','...SSSSS....','..SSSSSSS...','.SSDSSSDSS..','.SSSSSSSSS..','.SWKSSSWKS..','.SSSSSSSSS..','.SSSKKSSSS..','..SSSSSSS...','..SS...SS...','.SSS...SSS..','............']},
  brockulus:{p:{S:'#948872',D:'#584f43',K:'#2c281f',W:'#fff'},r:['...SSSSSS...','..SSDSSDSS..','.SSSSSSSSSS.','.SDSSSSSSDS.','.SWKSSSSWKS.','.SSSSSSSSSS.','.SSSKKKKSSS.','.SSSSSSSSSS.','..SSS..SSS..','.SSSS..SSSS.','............','............']},
  brockoloss:{p:{S:'#948872',D:'#4f473b',K:'#2c281f',W:'#fff'},r:['..SSSSSSSS..','.SDSSSSSSDS.','SSSSSSSSSSSS','SDSSSSSSSSDS','SSWKSSSSWKSS','SSSSSSSSSSSS','SSSKKKKKKSSS','SSSSSSSSSSSS','.SSSSSSSSSS.','.SSD....DSS.','SSSS....SSSS','............']},
  spuki:{p:{P:'#8a6cb8',L:'#b89ae0',K:'#241638',W:'#fff'},r:['....PPPP....','...PPPPPP...','..PPPPPPPP..','..PWKPPWKP..','..PPPPPPPP..','..PPPKKPPP..','..PPPPPPPP..','..PPPPPPPP..','..P.PP.PP...','..P..P..P...','............','............']},
  spukrator:{p:{P:'#7355a8',L:'#b89ae0',K:'#241638',W:'#fff',G:'#f0d240'},r:['..G..GG..G..','..PPPPPPPP..','.PPPPPPPPPP.','.PWKPPPPWKP.','.PPPPPPPPPP.','.PPPKKKKPPP.','.PPPPPPPPPP.','.PPPPPPPPPP.','.PP.PP.PP.P.','.P..P...P...','............','............']},
  spukfuerst:{p:{P:'#6a4a9c',L:'#c8aaf0',K:'#1a0f2e',W:'#fff',G:'#f0d240'},r:['.G..GG..G...','..PPPPPPPP..','.PPPPPPPPPP.','PPPPPPPPPPPP','PWKPPPPPWKPP','PPPPPPPPPPPP','PPPLLLLLLPPP','PPPPPPPPPPPP','PPPPPPPPPPPP','P.PP.PP.PP.P','.P..P..P..P.','............']},
  spuktyrann:{p:{P:'#3a1e5c',L:'#8a6ad0',K:'#0a0616',W:'#ff4a4a',G:'#f0d240'},r:['.G.GGGGG.G..','..PPPPPPPP..','.PPPPPPPPPP.','PPPPPPPPPPPP','PWKPPPPPWKPP','PPPPPPPPPPPP','PPPLLLLLLPPP','PPPPPPPPPPPP','PPPPPPPPPPPP','P.PP.PP.PP.P','.P..P..P..P.','............']},
  frosti:{p:{C:'#a8e8f5',B:'#5fb8c9',K:'#1e3a4a',W:'#fff'},r:['.....W......','....WCW.....','...CCCCC....','..CCCCCCC...','..CWKCCWKC..','..CCCCCCC...','..CCKKCCC...','...CCCCC....','...BBBBB....','...B...B....','..BB...BB...','............']},
  frostor:{p:{C:'#a8e8f5',B:'#4aa0b8',K:'#1e3a4a',W:'#fff'},r:['..W......W..','..WC....CW..','...CCCCCC...','..CCCCCCCC..','.CCCCCCCCCC.','.CWKCCCCWKC.','.CCCCCCCCCC.','.CCCKKKKCCC.','..BBBBBBBB..','..BB....BB..','.BBB....BBB.','............']},
  frostmonarch:{p:{C:'#c8f0ff',B:'#3f92ac',K:'#12293a',W:'#fff'},r:['.W..WWW..W..','.WC.CCC.CW..','.CCCCCCCCC..','CCCCCCCCCCC.','CCWKCCCCWKC.','CCCCCCCCCCC.','CCCWWWWWCCC.','CBBBBBBBBBC.','.BBBBBBBBB..','.BB.....BB..','BBB.....BBB.','............']},
  giftling:{p:{P:'#9a5aa8',G:'#7ac04a',K:'#2a1030',W:'#fff'},r:['............','....GGGG....','...GPPPPG...','..GPPPPPPG..','..PWKPPWKP..','..PPPPPPPP..','..PPPKKPPP..','..GPPPPPPG..','...GPPPPG...','....G..G....','...GG..GG...','............']},
  giftkralle:{p:{P:'#8a4a9c',G:'#7ac04a',K:'#2a1030',W:'#fff'},r:['..G......G..','..GG....GG..','..GPPPPPPG..','.GPPPPPPPPG.','.PWKPPPPWKP.','.PPPPPPPPPP.','.PPPKKKKPPP.','.GPPPPPPPPG.','..GPPPPPPG..','..GG....GG..','.GGG....GGG.','............']},
  giftrex:{p:{P:'#7a3a8c',G:'#8ad05a',K:'#1a0820',W:'#fff'},r:['.G..GGGG..G.','.GG.GGGG.GG.','.GPPPPPPPPG.','GPPPPPPPPPPG','GPWKPPPPWKPG','GPPPPPPPPPPG','GPPGGGGGGPPG','GPPPPPPPPPPG','.GPPPPPPPPG.','.GG.....GGG.','GGG.....GGG.','............']},
  flatterix:{p:{B:'#c9c0a8',D:'#8a7f6d',K:'#2c281f',W:'#fff',Y:'#e8b93c'},r:['............','....BBBB....','...BBBBBB...','..BWKBBWKB..','..BBBYYBBB..','.BBBBBBBBBB.','.DBBBBBBBBD.','.DDBBBBBBDD.','..DBBBBBBD..','...BB..BB...','...Y....Y...','............']},
  flatterax:{p:{B:'#b8ab90',D:'#7a6f5d',K:'#2c281f',W:'#fff',Y:'#e8b93c'},r:['...BBBBBB...','..BBBBBBBB..','..BWKBBWKB..','..BBBYYBBB..','.BBBBBBBBBB.','DBBBBBBBBBBD','DDBBBBBBBBDD','DDDBBBBBBDDD','.DDBBBBBBDD.','..DBB..BBD..','...Y....Y...','............']},
  flatterlord:{p:{B:'#d0c4a4',D:'#6a5f4d',K:'#221e17',W:'#fff',Y:'#f0c93c'},r:['..YY.BB.YY..','..BBBBBBBB..','..BWKBBWKB..','..BBBYYBBB..','.BBBBBBBBBB.','DBBBBBBBBBBD','DDBBBBBBBBDD','DDDBBBBBBDDD','DDDDBBBBDDDD','..DBB..BBD..','..YY....YY..','............']},
  silvarion:{p:{G:'#2a5e33',L:'#7fd06a',K:'#122814',W:'#fff',Y:'#f0d240'},r:['...Y....Y...','..YGG..GGY..','.GGGGGGGGGG.','GGLLLLLLLLGG','GLLLLLLLLLLG','GLWKLLLLWKLG','GLLLLLLLLLLG','GLLLYYYYLLLG','.GLLLLLLLLG.','..GLL..LLG..','.GGG....GGG.','............']},
  voltrex:{p:{Y:'#f5d63a',D:'#a87920',K:'#3a2c10',W:'#fff',B:'#5fb8e8'},r:['..D.Y..Y.D..','.DYYYYYYYYD.','DYYYYYYYYYYD','YYYYYYYYYYYY','YYWKYYYYWKYY','YYYYYYYYYYYY','YYYBBBBBBYYY','YYYYYYYYYYYY','DYYYYYYYYYYD','.DYY....YYD.','..D......D..','............']},
  umbrakor:{p:{P:'#4e2f7a',L:'#b89ae0',K:'#0e0618',W:'#fff'},r:['.K..KKKK..K.','..PPPPPPPP..','.PPPPPPPPPP.','PPPPPPPPPPPP','PPWKPPPPWKPP','PPPPPPPPPPPP','PPPLLLLLLPPP','PPPPPPPPPPPP','PPPPPPPPPPPP','.PP.PP.PP.P.','..P..P..P...','............']},
  aeternis:{p:{S:'#e8e4f0',G:'#f0c93c',K:'#2a2438',W:'#fff'},r:['..G.GGGG.G..','.GSSSSSSSSG.','GSSSSSSSSSSG','SSSSSSSSSSSS','SSWKSSSSWKSS','SSSSSSSSSSSS','SSSGGGGGGSSS','SSSSSSSSSSSS','GSSSSSSSSSSG','.GSS....SSG.','..G......G..','............']},
  abbild_silvarion:{p:{G:'#5d7f75',L:'#a8c9b8',K:'#2a3630',W:'#dfe8e4',Y:'#c9d8a0'},r:['...Y....Y...','..YGG..GGY..','.GGGGGGGGGG.','GGLLLLLLLLGG','GLLLLLLLLLLG','GLWKLLLLWKLG','GLLLLLLLLLLG','GLLLYYYYLLLG','.GLLLLLLLLG.','..GLL..LLG..','.GGG....GGG.','............']},
  abbild_voltrex:{p:{Y:'#c9c090',D:'#8a7a5a',K:'#3a362a',W:'#eee',B:'#9ab8c0'},r:['..D.Y..Y.D..','.DYYYYYYYYD.','DYYYYYYYYYYD','YYYYYYYYYYYY','YYWKYYYYWKYY','YYYYYYYYYYYY','YYYBBBBBBYYY','YYYYYYYYYYYY','DYYYYYYYYYYD','.DYY....YYD.','..D......D..','............']},
  abbild_umbrakor:{p:{P:'#736084',L:'#c2b0d8',K:'#241e2c',W:'#eee'},r:['.K..KKKK..K.','..PPPPPPPP..','.PPPPPPPPPP.','PPPPPPPPPPPP','PPWKPPPPWKPP','PPPPPPPPPPPP','PPPLLLLLLPPP','PPPPPPPPPPPP','PPPPPPPPPPPP','.PP.PP.PP.P.','..P..P..P...','............']},
  abbild_aeternis:{p:{S:'#c8c4d0',G:'#c0b380',K:'#3a3644',W:'#eee'},r:['..G.GGGG.G..','.GSSSSSSSSG.','GSSSSSSSSSSG','SSSSSSSSSSSS','SSWKSSSSWKSS','SSSSSSSSSSSS','SSSGGGGGGSSS','SSSSSSSSSSSS','GSSSSSSSSSSG','.GSS....SSG.','..G......G..','............']},
  valenor:{p:{S:'#dce8f2',I:'#8fc4e0',K:'#1c2e3a',W:'#fff',M:'#c9d4dc',Y:'#f0e6b8'},r:['..MYY..YYM..','.MMIIIIIIMM.','MIISSSSSSIIM','IISSSSSSSSII','ISSWKSSSSWKS','ISSSSSSSSSSI','ISSSMMMMSSSI','IISSSSSSSSII','MIISSSSSSIIM','.MMII..IIMM.','..MI....IM..','............']},
  nebelwisp:{p:{P:'#9a7ad0',L:'#c9b0f0',W:'#fff',K:'#4a3a70'},r:['............','....LLLL....','...LPPPPL...','..LPPWWPPL..','..LPPWWPPL..','..LPPPPPPL..','...LPPPPL...','....LLLL....','...K....K...','..K......K..','.K........K.','............']},
  draklin:{p:{D:'#4a3a90',L:'#7a6ad0',K:'#160f30',W:'#fff',R:'#e05a5a'},r:['............','...D....D...','...DD..DD...','..DDDDDDDD..','..DLLLLLLD..','..LWKLLWKL..','..LLLLLLLL..','..LLKKKKLL..','...LLLLLL...','...L....L...','..LL....LL..','............']},
  drakon:{p:{D:'#42327f',L:'#7a6ad0',K:'#160f30',W:'#fff',R:'#e05a5a'},r:['..D......D..','..DD....DD..','.DDDDDDDDDD.','.DLLLLLLLLD.','.LWKLLLLWKL.','.LLLLLLLLLL.','.LLKKKKKKLL.','.LLLLLLLLLL.','..LLLLLLLL..','..LL....LL..','.LLL....LLL.','............']},
  draconar:{p:{D:'#3a2a72',L:'#8a7ae0',K:'#120c28',W:'#fff',R:'#e05a5a'},r:['.D..DDDD..D.','.DD.DDDD.DD.','DDDDDDDDDDDD','DLLLLLLLLLLD','LWKLLLLLLWKL','LLLLLLLLLLLL','LLRRRRRRRRLL','LLLLLLLLLLLL','.LLLLLLLLLL.','.LL......LL.','LLL......LLL','............']},
  erzling:{p:{S:'#9aa4b8',D:'#5a6272',K:'#20242e',W:'#fff',B:'#6ad0e8'},r:['............','....SSSS....','...SSSSSS...','..SSSSSSSS..','..SWKSSWKS..','..SSSSSSSS..','..SSKKKKSS..','..DSSSSSSD..','...DSSSSD...','...D....D...','..DD....DD..','............']},
  erzkralle:{p:{S:'#8e98ac',D:'#4e5666',K:'#20242e',W:'#fff',B:'#6ad0e8'},r:['..D......D..','..DD....DD..','.SSSSSSSSSS.','.SSSSSSSSSS.','.SWKSSSSWKS.','.SSSSSSSSSS.','.SSKKKKKKSS.','.DSSSSSSSSD.','..DSSSSSSD..','..DD....DD..','.DDD....DDD.','............']},
  erzkoloss:{p:{S:'#8e98ac',D:'#454c5c',K:'#181c26',W:'#fff',B:'#6ad0e8'},r:['.D..SSSS..D.','.DD.SSSS.DD.','DSSSSSSSSSSD','DSSSSSSSSSSD','SWKSSSSSSWKS','SSSSSSSSSSSS','SSBBBBBBBBSS','SSSSSSSSSSSS','DSSSSSSSSSSD','DD......DD..','DDD......DDD','............']},
  faustli:{p:{R:'#c25a3a',O:'#e8923c',K:'#2a1408',W:'#fff',Y:'#f0d240'},r:['............','....RRRR....','...RRRRRR...','..RWKRRWKR..','..RRRRRRRR..','..RRKKKKRR..','..RRRRRRRR..','.OORRRRRROO.','.OO.RRRR.OO.','....R..R....','...OO..OO...','............']},
  fauster:{p:{R:'#b44f32',O:'#e8923c',K:'#2a1408',W:'#fff',Y:'#f0d240'},r:['...RRRRRR...','..RRRRRRRR..','..RWKRRWKR..','..RRRRRRRR..','.RRRKKKKRRR.','.RRRRRRRRRR.','OORRRRRRRROO','OORRRRRRRROO','.OO.RRRR.OO.','....RRRR....','...OO..OO...','............']},
  faustitan:{p:{R:'#a8452a',O:'#e8923c',K:'#22100a',W:'#fff',Y:'#f0d240'},r:['..RRRRRRRR..','.RRRRRRRRRR.','.RWKRRRRWKR.','.RRRRRRRRRR.','RRRRKKKKRRRR','RRRRRRRRRRRR','OORRRYYRRROO','OORRRRRRRROO','OORRRRRRRROO','.OO.RRRR.OO.','..OO....OO..','............']},
  zwitscherling:{p:{B:'#6ab8e8',O:'#e8923c',K:'#1c2838',W:'#fff'},r:['............','.....B......','....BBB.....','...BBBBB....','..BWKBBWKB..','.BBBBBBBBBB.','BBBBBBBBBBBB','.OOB....BOO.','..O......O..','............','............','............']},
  sturmvogel:{p:{B:'#4a7fa8',O:'#d8d0c0',K:'#141c28',W:'#fff'},r:['............','....BB.BB...','...BBB.BBB..','..BBBBBBBBB.','.BBWKBBBWKB.','BBBBBBBBBBBB','BBBBBBBBBBBB','OOBB....BBOO','.O..OOOO..O.','............','............','............']},
  dornkeim:{p:{G:'#7ac04a',T:'#3a5a28',K:'#1a2810',W:'#fff'},r:['............','.....T......','....TGT.....','...TGGGT....','..GGGGGGG...','..GWKGGWKG..','..GGGGGGGG..','...GGGGGG...','....GGGG....','...T....T...','............','............']},
  dornranke:{p:{G:'#5a9a3c',T:'#2e4a20',K:'#162010',W:'#fff'},r:['.....T..T...','......TT....','.....GGG....','....GGGGG...','...GGGGGGG..','..GWKGGWKG..','..GGGGGGGG..','..TGGGGGT...','...GGGGG....','....G..G....','...GG..GG...','............']},
  dornfuerst:{p:{G:'#3c7a2e',T:'#7a4a9c',K:'#141e10',W:'#fff'},r:['..T.T..T.T..','...TTTTTT...','....GGGG....','...GGGGGG...','..GGGGGGGG..','..GWKGGWKG..','..GGGGGGGG..','.TGGGGGGGGT.','..GGGGGGGG..','...G....G...','..GG....GG..','............']},
  kieselknirps:{p:{S:'#9a9088',F:'#6a6058',K:'#28241e',W:'#fff'},r:['............','....SSSS....','...SSSSSS...','..SSSSSSSS..','F.SWKSSWKS.F','FFSSSSSSSSFF','.FSSSSSSSSF.','..SSSSSSSS..','...S....S...','............','............','............']},
  felsschlaeger:{p:{S:'#847a70',F:'#544c42',K:'#201c18',W:'#fff'},r:['............','....SSSS....','F..SWKSSWKS.','FF.SSSSSSSS.','FFFSSSSSSSSF','.FFSSSSSSSFF','..SSSSSSSS..','..SS....SS..','..S......S..','............','............','............']},
  bergbrecher:{p:{S:'#6e6458',F:'#403a30',K:'#181410',W:'#fff'},r:['...SSSSSS...','..SSSSSSSS..','.SSSSSSSSSS.','FSSWKSSWKSF.','FFSSSSSSSSFF','FFFSSSSSSFFF','.FFSSSSSSFF.','..SSSSSSSS..','..SS.SS.SS..','..S..SS..S..','............','............']},
  schaltling:{p:{M:'#c9a83c',S:'#9aa0a8',K:'#242830',W:'#fff'},r:['..M.MM.MM.M.','.MMMMMMMMMM.','MMSSSSSSSSMM','MSWKSSSWKSM.','MSSSSSSSSSM.','MSSKKKKKSM..','MSSSSSSSSSM.','.MSSSSSSSM..','..M.....M...','............','............','............']},
  reaktorit:{p:{M:'#e0b83c',S:'#7a828c',Y:'#8fe0e0',K:'#1c2028',W:'#fff'},r:['.M.MMM.MMM.M','MMMMMMMMMMMM','MSSSSSSSSSSM','MSWKSSSSWKSM','MSSSYYYYSSSM','MSSSYKKYSSSM','MSSSYYYYSSSM','MSSSSSSSSSSM','.MSS.MM.SSM.','..M......M..','............','............']},
  firnling:{p:{D:'#8fc4e0',I:'#c0e4f0',K:'#1c3040',W:'#fff'},r:['............','...D....D...','...DD..DD...','..DIIIIIID..','..IWKIIIWKI.','..IIIIIIII..','..IIKKKKII..','...IIIIII...','...I....I...','..II....II..','............','............']},
  firndrake:{p:{D:'#5a9ec0',I:'#d8f0f8',K:'#122430',W:'#fff'},r:['..D......D..','.DDI....IDD.','..DIIIIIID..','.IIIIIIIIII.','IIWKIIIIWKII','IIIIIIIIIIII','IIIKKKKKKIII','.IIIIIIIIII.','..II....II..','..I......I..','............','............']},
  lichthirsch:{p:{B:'#e0c8a0',A:'#c9a878',K:'#3a2c1c',W:'#fff'},r:['.A......A...','..A....A....','...A....A...','....BBBB....','...BWKBBWKB.','...BBBBBBBB.','...BBBBBBB..','....BBBB....','....B..B....','...BB..BB...','............','............']},
  nesselqualle:{p:{P:'#c07ad0',K:'#3a1c40',W:'#fff'},r:['............','....PPPP....','...PPPPPP...','..PPPPPPPP..','..PWKPPWKP..','..PPPPPPPP..','..PPPPPPPP..','...P.P.P....','...P.P.P....','..P..P..P...','..P..P..P...','............']},
  grimling:{p:{F:'#8a8a94',E:'#6a6a74',K:'#1c1c22',W:'#fff',O:'#e8923c'},r:['.......EE...','......EWKEE.','.....FFFFFFO','....FFFFFFFF','...FFFFFFFFF','..FFFFFFFFF.','..FF.FF..FF.','..FF.FF..FF.','............','............','............','............']},
  grimmwolf:{p:{F:'#6a6a78',E:'#4a4a58',K:'#14141a',W:'#fff',O:'#e8923c'},r:['........EE..','.......EWKEE','......FFFFFO','....FFFFFFFF','...FFFFFFFFF','..FFFFFFFFFF','.FFFFFFFFFF.','.FF.FF..FF..','.FF.FF..FF..','............','............','............']},
  alphagrimm:{p:{F:'#4a4a58',E:'#2c2c38',K:'#0e0e12',W:'#fff',O:'#e8923c',M:'#8a8a9c'},r:['.M.......EE.','MM......EWKE','MMM....FFFFO','MM.FFFFFFFF.','..FFFFFFFFFF','.FFFFFFFFFFF','.FFFFFFFFFF.','.FFF.FF.FFF.','.FFF.FF.FFF.','............','............','............']},
  schlingling:{p:{G:'#7ac04a',K:'#1a2810',W:'#fff'},r:['....GG......','...GWKG.....','....GG......','...GGG......','..GGG.......','..GGG.......','...GGG......','....GGG.....','....GGG.....','...GGG......','..GG........','............']},
  nattrax:{p:{G:'#4a9c3a',K:'#0e1c08',W:'#fff'},r:['...GGG......','..GWKWKG....','...GGGG.....','....GGG.....','...GGGG.....','..GGGG......','..GGGG......','...GGGG.....','....GGGG....','.....GGGG...','......GG....','............']},
  wuestling:{p:{D:'#c9a870',E:'#8a6a48',K:'#2c2013',W:'#fff'},r:['...E....E...','..EE....EE..','..E......E..','...DDDDDD...','..DDWKDDWKD.','..DDDDDDDD..','..DDDDDDDD..','...D....D...','...D....D...','..DD....DD..','............','............']},
  wuestenfuerst:{p:{D:'#b89460',E:'#6a4c30',K:'#22190f',W:'#fff',M:'#8a6a48'},r:['..E......E..','.EE......EE.','.E........E.','..DDDDDDDD..','.DDWKDDWKDD.','.DDDDDDDDDD.','MDDDDDDDDDDM','.DDDDDDDDDD.','..D......D..','..D......D..','.DD......DD.','............']},
  rotfell:{p:{R:'#d8703c',E:'#a8502a',K:'#2c1408',W:'#fff',T:'#f0b878'},r:['..E..E......','.EE.EE......','..RRRR......','.RWKRWKR....','.RRRRRRR....','.RRRRRR.TT..','..R...TTTTT.','..R....TTTT.','..RR...TTT..','............','............','............']},
  neunschweif:{p:{R:'#c05a2a',E:'#8a3e1c',K:'#200e06',W:'#fff',T:'#f0d0a0'},r:['..E..E......','.EE.EE......','..RRRR......','.RWKRWKR....','.RRRRRRR.T..','.RRRRRR.TTT.','..R...TT.TTT','..R....TT.TT','..RR....TT.T','............','............','............']},
  vielhaupt:{p:{G:'#5a3a7c',K:'#120c1c',W:'#fff'},r:['.G...G...G..','GWK.GWK.GWK.','.GG..G...GG.','..GGGGGGGG..','..GGGGGGGG..','.GGGGGGGGGG.','.GGGGGGGGGG.','.GG......GG.','.GG......GG.','............','............','............']},
  dreiwart:{p:{P:'#6a5478',K:'#161020',W:'#fff'},r:['.P...P...P..','PWK.PWK.PWK.','.PP..P...PP.','.PPPPPPPPPP.','PPPPPPPPPPPP','PPPPPPPPPPPP','.PPPPPPPPPP.','.PPP....PPP.','.PPP....PPP.','............','............','............']},
  wolkenross:{p:{S:'#e8e4f0',B:'#c9c4d8',K:'#3a3648',W:'#fff'},r:['......SS....','.....SWKS...','..BB.SSSSBB.','.BBBSSSSSBBB','BB...SSSS.BB','.....SSSS...','.....S..S...','....S....S..','............','............','............','............']},
  sternross:{p:{S:'#f0ecf8',B:'#d8c8e8',K:'#241e34',W:'#fff',Y:'#f0d240'},r:['......SS....','.....YWKS...','.BBB.SSSSBBB','BBBBSSSSSBBB','BBB..SSSS.BB','B....SSSS..B','.....S..S...','....S....S..','....S....S..','............','............','............']},
  giftschlinge:{p:{G:'#7a5a9c',K:'#1c1428',W:'#fff'},r:['.G.......G..','GWKG....GWKG','.GG.....GG..','..GG...GG...','...GGGG.....','..GGGGGG....','.GGGGGGGG...','.GG.....GG..','............','............','............','............']},
  krabbo:{p:{R:'#e07050',D:'#a84a35',K:'#2a1410',W:'#fff'},r:['............','.D........D.','.DD......DD.','..RRRRRRRR..','.RRRRRRRRRR.','.RWKRRRRWKR.','.RRRRRRRRRR.','.RRRKKKKRRR.','..RRRRRRRR..','..R.R..R.R..','.RR.R..R.RR.','............']},
  krabbor:{p:{R:'#d05f42',D:'#98402c',K:'#2a1410',W:'#fff'},r:['.D........D.','.DDD....DDD.','.DDRRRRRRDD.','.RRRRRRRRRR.','RRRRRRRRRRRR','RRWKRRRRWKRR','RRRRRRRRRRRR','RRRKKKKKKRRR','.RRRRRRRRRR.','..RR.RR.RR..','.RR..RR..RR.','............']},
  krabbolem:{p:{R:'#c04f35',D:'#7a3020',K:'#1a0c08',W:'#fff'},r:['DD........DD','DDD......DDD','DDDRRRRRRDDD','.RRRRRRRRRR.','RRRRRRRRRRRR','RRWKRRRRWKRR','RRRRRRRRRRRR','RRRKKKKKKRRR','RRRRRRRRRRRR','.RR.RRRR.RR.','RRR.RRRR.RRR','............']}
};
const HUMAN=['....BBBB....','...BBBBBB...','...FFFFFF...','...FKFFKF...','...FFFFFF...','....RRRR....','...RRRRRR...','...RRRRRR...','....JJJJ....','....J..J....','....J..J....','...KK..KK...'];

// ============================ BILD-SPRITES (Hybrid) ============================
// Arten mit eigenem PNG (als Base64 eingebettet) nutzen dieses Bild automatisch.
// Fehlt ein Eintrag, greift wie bisher das 12x12-Pixel-Raster aus SP. So können
// Sprites einzeln nach und nach ersetzt werden, ohne den Rest anzufassen.
const SPRITE_IMG_SRC={
  // Beispiel-Eintrag zum Testen der Bild-Pipeline:
  // flamko:'data:image/png;base64,iVBORw0KGgo...'
};
const SPRITE_IMG={};
Object.keys(SPRITE_IMG_SRC).forEach(id=>{
  const img=new Image();
  img.src=SPRITE_IMG_SRC[id];
  SPRITE_IMG[id]=img;
});
function spriteImgReady(id){
  const img=SPRITE_IMG[id];
  return !!(img&&img.complete&&img.naturalWidth>0);
}
function paintMonImage(ctx,id,x,y,s,flip,shiny){
  const img=SPRITE_IMG[id];
  const w=12*s,h=12*s; // gleiche Bezugsgröße wie die 12x12-Pixel-Sprites
  ctx.fillStyle='rgba(20,14,30,.22)';
  ctx.beginPath();
  ctx.ellipse(x+w/2,y+h*1.02,w*.38,s*.75,0,0,Math.PI*2);
  ctx.fill();
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  if(shiny)ctx.filter='hue-rotate(140deg) saturate(1.4) brightness(1.05)';
  if(flip){
    ctx.translate(x+w,y);ctx.scale(-1,1);
    ctx.drawImage(img,0,0,w,h);
  }else{
    ctx.drawImage(img,x,y,w,h);
  }
  ctx.restore();
}

// ---- Farbhilfen ----
function hex2rgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function rgb2hex(r,g,b){const c=v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');return '#'+c(r)+c(g)+c(b);}
function shade(hex,f){const[r,g,b]=hex2rgb(hex);return rgb2hex(r*f,g*f,b*f);}
function shinyColor(hex){const[r,g,b]=hex2rgb(hex);return rgb2hex(b*.9+40,r*.85+30,g*.9+20);}

// Sprite mit Kontur, Schattierung und Bodenschatten
function spriteN(sp){return sp.r.length;}
function paintMon(ctx,id,x,y,s,flip,shiny){
  if(spriteImgReady(id)){paintMonImage(ctx,id,x,y,s,flip,shiny);return;}
  const sp=SP[id];if(!sp)return;
  const N=spriteN(sp);
  // gemeinsame Bezugsgröße: 12er- und 16er-Sprites erscheinen gleich groß
  s=s*12/N;
  const grid=[];
  for(let ry=0;ry<N;ry++){grid.push([]);
    for(let rx=0;rx<N;rx++){const ch=sp.r[ry][flip?N-1-rx:rx];grid[ry].push(ch==='.'?null:ch);}}
  // Bodenschatten
  let minX=N,maxX=-1,maxY=-1;
  for(let ry=0;ry<N;ry++)for(let rx=0;rx<N;rx++)if(grid[ry][rx]){if(rx<minX)minX=rx;if(rx>maxX)maxX=rx;if(ry>maxY)maxY=ry;}
  if(maxY>=0){
    ctx.fillStyle='rgba(20,14,30,.22)';
    ctx.beginPath();
    ctx.ellipse(x+(minX+maxX+1)/2*s,y+(maxY+1.25)*s,(maxX-minX+1)*s*.42,s*.75,0,0,Math.PI*2);
    ctx.fill();
  }
  // Kontur
  ctx.fillStyle='#1d1729';
  for(let ry=0;ry<N;ry++)for(let rx=0;rx<N;rx++){
    if(grid[ry][rx])continue;
    const n=(ry>0&&grid[ry-1][rx])||(ry<N-1&&grid[ry+1][rx])||(rx>0&&grid[ry][rx-1])||(rx<N-1&&grid[ry][rx+1]);
    if(n)ctx.fillRect(x+rx*s,y+ry*s,s,s);
  }
  // Pixel mit Höhenschattierung
  for(let ry=0;ry<N;ry++)for(let rx=0;rx<N;rx++){
    const ch=grid[ry][rx];if(!ch)continue;
    let col=sp.p[ch]||'#000';
    if(shiny)col=shinyColor(col);
    ctx.fillStyle=shade(col,1.12-0.24*(ry/(N-1)));
    ctx.fillRect(x+rx*s,y+ry*s,s,s);
  }
}
function paintHuman(ctx,pal,x,y,s){
  ctx.fillStyle='rgba(20,14,30,.22)';
  ctx.beginPath();ctx.ellipse(x+6*s,y+12.2*s,4.2*s,.8*s,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#1d1729';
  for(let ry=0;ry<12;ry++)for(let rx=0;rx<12;rx++){
    if(HUMAN[ry][rx]!=='.')continue;
    const n=(ry>0&&HUMAN[ry-1][rx]!=='.')||(ry<11&&HUMAN[ry+1][rx]!=='.')||(rx>0&&HUMAN[ry][rx-1]!=='.')||(rx<11&&HUMAN[ry][rx+1]!=='.');
    if(n)ctx.fillRect(x+rx*s,y+ry*s,s,s);
  }
  for(let ry=0;ry<12;ry++)for(let rx=0;rx<12;rx++){
    const ch=HUMAN[ry][rx];if(ch==='.')continue;
    ctx.fillStyle=shade(pal[ch]||'#000',1.1-0.2*(ry/11));
    ctx.fillRect(x+rx*s,y+ry*s,s,s);
  }
}
function monCanvas(cv,id,shiny){
  if(!cv||(!SP[id]&&!SPRITE_IMG[id]))return;const ctx=cv.getContext('2d');if(!ctx)return;
  ctx.clearRect(0,0,cv.width,cv.height);
  // feste Anzeigegröße: Sprite füllt die Fläche immer gleich aus
  const s=(cv.width*0.92)/12;
  const w=s*12;
  paintMon(ctx,id,(cv.width-w)/2,(cv.height-w)/2,s,false,shiny);
}

const HERO_PAL={B:'#3a6cb0',F:'#f0c9a0',K:'#2b1d16',R:'#c94f6d',J:'#33445e'};
const RIVAL_PAL={B:'#c94f6d',F:'#f0c9a0',K:'#2b1d16',R:'#33445e',J:'#2a2438'};
const TR_PALS=[{B:'#5aa464',F:'#f0c9a0',K:'#2b1d16',R:'#e8b93c',J:'#5c5470'},
  {B:'#8a7f6d',F:'#e3b184',K:'#2b1d16',R:'#4a7fc1',J:'#33445e'},
  {B:'#4a7fc1',F:'#f0c9a0',K:'#2b1d16',R:'#5aa464',J:'#3e3852'},
  {B:'#d9a92c',F:'#e3b184',K:'#2b1d16',R:'#d95b43',J:'#33445e'},
  {B:'#7a5da8',F:'#f0c9a0',K:'#2b1d16',R:'#5fb8c9',J:'#5c5470'}];
const BOSS_PAL={B:'#241638',F:'#e3b184',K:'#000',R:'#7a5da8',J:'#1a0f2e'};

// ============================ DEX ============================
// base: [hp, atk, def, spd]
const DEX={
  flamko:{name:'Flamko',type:'Feuer',base:[11,13,9,12],evo:'flamkor',evoLvl:14},
  flamkor:{name:'Flamkor',type:'Feuer',base:[13,16,11,14],evo:'flamgeddon',evoLvl:30},
  flamgeddon:{name:'Flamgeddon',type:'Feuer',base:[15,20,13,16]},
  aquappi:{name:'Aquappi',type:'Wasser',base:[13,11,12,10],evo:'aquadon',evoLvl:14},
  aquadon:{name:'Aquadon',type:'Wasser',base:[15,13,15,11],evo:'aquatlas',evoLvl:30},
  aquatlas:{name:'Aquatlas',type:'Wasser',base:[18,16,18,12]},
  blattli:{name:'Blattli',type:'Pflanze',base:[14,12,13,11],evo:'blattlon',evoLvl:14},
  blattlon:{name:'Blattlon',type:'Pflanze',base:[16,15,15,12],evo:'blattgigant',evoLvl:30},
  blattgigant:{name:'Blattgigant',type:'Pflanze',base:[20,18,19,13],evo:'blattmonarch',evoLvl:1,evoItem:'wurzelkristall'},
  blattmonarch:{name:'Blattmonarch',type:'Pflanze',base:[24,21,22,15]},
  zappzap:{name:'Zappzap',type:'Elektro',base:[10,12,9,16],evo:'zappzorn',evoLvl:14},
  zappzorn:{name:'Zappzorn',type:'Elektro',base:[12,15,10,19],evo:'zapptitan',evoLvl:30},
  zapptitan:{name:'Zapptitan',type:'Elektro',base:[14,18,12,22]},
  brockel:{name:'Brockel',type:'Stein',base:[14,11,17,6],evo:'brockulus',evoLvl:14},
  brockulus:{name:'Brockulus',type:'Stein',base:[17,14,20,7],evo:'brockoloss',evoLvl:30},
  brockoloss:{name:'Brockoloss',type:'Stein',base:[20,17,24,8]},
  spuki:{name:'Spuki',type:'Geist',base:[10,14,8,14],evo:'spukrator',evoLvl:14},
  spukrator:{name:'Spukrator',type:'Geist',base:[12,17,10,16],evo:'spukfuerst',evoLvl:30},
  spukfuerst:{name:'Spukfürst',type:'Geist',base:[14,21,12,18],evo:'spuktyrann',evoLvl:1,evoItem:'seelenanker'},
  spuktyrann:{name:'Spuktyrann',type:'Geist',base:[17,25,14,21]},
  frosti:{name:'Frosti',type:'Eis',type2:'Wasser',base:[12,12,12,10],evo:'frostor',evoLvl:14},
  frostor:{name:'Frostor',type:'Eis',type2:'Wasser',base:[14,15,14,11],evo:'frostmonarch',evoLvl:30},
  frostmonarch:{name:'Frostmonarch',type:'Eis',type2:'Wasser',base:[17,18,17,13]},
  giftling:{name:'Giftling',type:'Gift',base:[11,13,10,13],evo:'giftkralle',evoLvl:14},
  giftkralle:{name:'Giftlurch',type:'Gift',base:[13,16,12,15],evo:'giftrex',evoLvl:30},
  giftrex:{name:'Giftrex',type:'Gift',base:[15,19,14,17]},
  flatterix:{name:'Flatterix',type:'Normal',type2:'Flug',base:[11,12,10,15],evo:'flatterax',evoLvl:14},
  flatterax:{name:'Flatterax',type:'Normal',type2:'Flug',base:[13,15,12,18],evo:'flatterlord',evoLvl:30},
  flatterlord:{name:'Flatterlord',type:'Normal',type2:'Flug',base:[15,18,14,21]},
  silvarion:{name:'Silvarion',type:'Pflanze',base:[21,16,19,14],legend:true},
  voltrex:{name:'Voltrex',type:'Elektro',base:[20,17,16,21],legend:true},
  umbrakor:{name:'Umbrakor',type:'Geist',base:[20,18,16,18],legend:true},
  aeternis:{name:'Aeternis',type:'Normal',type2:'Drache',base:[23,19,21,19],legend:true},
  abbild_silvarion:{name:'Abbild des Silvarion',type:'Pflanze',base:[19,15,17,13]},
  abbild_voltrex:{name:'Abbild des Voltrex',type:'Elektro',base:[18,16,15,19]},
  abbild_umbrakor:{name:'Abbild des Umbrakor',type:'Geist',base:[18,17,15,16]},
  abbild_aeternis:{name:'Abbild des Aeternis',type:'Normal',type2:'Drache',base:[21,18,19,17]},
  valenor:{name:'Valenor',type:'Metall',type2:'Eis',base:[25,22,23,20],legend:true},
  nebelwisp:{name:'Nebelwisp',type:'Geist',base:[16,15,14,17]},
  krabbo:{name:'Krabbo',type:'Wasser',type2:'Stein',base:[12,13,14,8],evo:'krabbor',evoLvl:14},
  krabbor:{name:'Krabbor',type:'Wasser',type2:'Stein',base:[14,16,17,9],evo:'krabbolem',evoLvl:30},
  krabbolem:{name:'Krabbolem',type:'Wasser',type2:'Stein',base:[17,19,20,10]},
  draklin:{name:'Draklin',type:'Drache',base:[13,14,13,12],evo:'drakon',evoLvl:16},
  drakon:{name:'Drakon',type:'Drache',base:[15,17,15,14],evo:'draconar',evoLvl:32},
  draconar:{name:'Draconar',type:'Drache',base:[18,21,17,16]},
  erzling:{name:'Erzling',type:'Metall',base:[13,12,17,7],evo:'erzkralle',evoLvl:15},
  erzkralle:{name:'Erzritter',type:'Metall',base:[15,15,20,8],evo:'erzkoloss',evoLvl:31},
  erzkoloss:{name:'Erzkoloss',type:'Metall',base:[18,18,23,9]},
  faustli:{name:'Faustli',type:'Kampf',base:[13,15,11,12],evo:'fauster',evoLvl:14},
  fauster:{name:'Fauster',type:'Kampf',base:[15,18,13,14],evo:'faustitan',evoLvl:30},
  faustitan:{name:'Faustitan',type:'Kampf',base:[18,22,15,16]},
  zwitscherling:{name:'Zwitscherling',type:'Flug',base:[10,10,7,15],evo:'sturmvogel',evoLvl:16},
  sturmvogel:{name:'Sturmvogel',type:'Flug',base:[15,16,11,22]},
  dornkeim:{name:'Dornkeim',type:'Gift',type2:'Pflanze',base:[9,9,10,6],evo:'dornranke',evoLvl:14},
  dornranke:{name:'Dornranke',type:'Gift',type2:'Pflanze',base:[13,13,14,9],evo:'dornfuerst',evoLvl:30},
  dornfuerst:{name:'Dornfürst',type:'Gift',type2:'Pflanze',base:[17,18,18,12]},
  kieselknirps:{name:'Kieselknirps',type:'Kampf',type2:'Stein',base:[10,11,9,6],evo:'felsschlaeger',evoLvl:14},
  felsschlaeger:{name:'Felsschläger',type:'Kampf',type2:'Stein',base:[14,16,13,9],evo:'bergbrecher',evoLvl:30},
  bergbrecher:{name:'Bergbrecher',type:'Kampf',type2:'Stein',base:[19,21,17,11]},
  schaltling:{name:'Schaltling',type:'Metall',type2:'Elektro',base:[10,9,12,10],evo:'reaktorit',evoLvl:16},
  reaktorit:{name:'Reaktorit',type:'Metall',type2:'Elektro',base:[15,15,18,15]},
  firnling:{name:'Firnling',type:'Drache',type2:'Eis',base:[11,11,10,11],evo:'firndrake',evoLvl:16},
  firndrake:{name:'Firndrake',type:'Drache',type2:'Eis',base:[17,18,15,16]},
  lichthirsch:{name:'Lichthirsch',type:'Normal',base:[14,12,12,14]},
  nesselqualle:{name:'Nesselqualle',type:'Wasser',type2:'Gift',base:[13,13,10,13]},
  grimling:{name:'Grimling',type:'Normal',type2:'Kampf',base:[9,10,8,11],evo:'grimmwolf',evoLvl:14},
  grimmwolf:{name:'Grimmwolf',type:'Normal',type2:'Kampf',base:[13,15,11,16],evo:'alphagrimm',evoLvl:32},
  alphagrimm:{name:'Alphagrimm',type:'Normal',type2:'Kampf',base:[17,20,14,20]},
  schlingling:{name:'Schlingling',type:'Gift',base:[9,9,8,12],evo:'nattrax',evoLvl:16},
  nattrax:{name:'Nattrax',type:'Gift',base:[15,16,13,19]},
  wuestling:{name:'Wüstling',type:'Stein',type2:'Normal',base:[10,11,12,8],evo:'wuestenfuerst',evoLvl:16},
  wuestenfuerst:{name:'Wüstenfürst',type:'Stein',type2:'Normal',base:[16,17,18,12]},
  rotfell:{name:'Rotfell',type:'Geist',type2:'Normal',base:[10,9,9,13],evo:'neunschweif',evoLvl:18},
  neunschweif:{name:'Neunschweif',type:'Geist',type2:'Normal',base:[15,15,14,20]},
  giftschlinge:{name:'Giftschlinge',type:'Gift',type2:'Drache',base:[10,12,11,7],evo:'vielhaupt',evoLvl:20},
  vielhaupt:{name:'Vielhaupt',type:'Gift',type2:'Drache',base:[16,19,17,10]},
  dreiwart:{name:'Dreiwart',type:'Geist',type2:'Kampf',base:[15,16,17,10]},
  wolkenross:{name:'Wolkenross',type:'Flug',type2:'Normal',base:[11,10,9,14],evo:'sternross',evoLvl:18},
  sternross:{name:'Sternross',type:'Flug',type2:'Normal',base:[16,16,13,21]},
};
const FAMILIES=['flamko','aquappi','blattli','zappzap','brockel','spuki','frosti','giftling','flatterix','krabbo','draklin','erzling','faustli',
  'zwitscherling','dornkeim','kieselknirps','schaltling','firnling','lichthirsch','nesselqualle',
  'wuestling','schlingling','rotfell','giftschlinge','dreiwart','wolkenross','grimling'];
// ---- Kryptid-Lexikon: erzählende Texte statt reiner Werte ----
const LORE={
  flamko:'Sammelt glühende Kieselsteine und hortet sie in kleinen Erdlöchern. Man sagt, ein Feuer erlischt nie, solange ein Flamko in der Nähe wohnt.',
  flamkor:'Die Glut in seiner Brust wird mit jedem Kampf heißer. Schmiede in Ascheort lassen ihre Öfen gern von einem Flamkor bewachen.',
  flamgeddon:'Wenn ein Flamgeddon brüllt, sollen ganze Nebelbänke am Kraterrand verdampfen. Nur wenige haben eines aus der Nähe gesehen – und erzählen gern davon.',
  aquappi:'Springt bei Sonnenaufgang gern aus dem Wasser, um nach Insekten zu schnappen. Fischer an der Kristallküste deuten das als gutes Omen.',
  aquadon:'Zieht in kleinen Gruppen durch Flussmündungen und markiert sein Revier mit leisen, tiefen Rufen, die kilometerweit zu hören sind.',
  aquatlas:'Der Legende nach trägt ein einziger Aquatlas genug Kraft in den Flossen, um eine kleine Flotte zu kentern – wenn man ihn denn reizt.',
  blattli:'Die Blätter auf seinem Rücken drehen sich stets zur Sonne. Kinder in Mooshain binden ihm manchmal kleine Blütenkränze um, die es geduldig trägt.',
  blattlon:'Wächst so eng mit dem Wald zusammen, dass alte Bäume ihm manchmal Platz zu machen scheinen. Niemand weiß, ob das Zufall ist.',
  blattgigant:'Wo ein Blattgigant lange genug steht, beginnt nach einiger Zeit ein ganzer kleiner Hain zu wachsen.',
  zappzap:'Vor Gewittern wird es unruhig und knistert leise. Manche Bauern in der Steppe nutzen das als natürliche Wetterwarnung.',
  zappzorn:'Kann kleine Blitze zwischen seinen Hörnern erzeugen, wenn es sich erschrickt – meist zur eigenen Überraschung.',
  zapptitan:'Ein wandelnder Sturm auf vier Beinen. Wo ein Zapptitan entlangzieht, sollen sich Windmühlen von allein zu drehen beginnen.',
  brockel:'Schläft tagsüber fast ausschließlich und wird erst in der Dämmerung aktiv. Wanderer verwechseln schlafende Brockel gern mit Findlingen.',
  brockulus:'Seine Haut wird mit den Jahren härter als mancher Fels. Steinmetze in Felsenwacht schwören, dass sein Rücken Werkzeuge stumpf werden lässt.',
  brockoloss:'Manche Berghänge, so heißt es, sind eigentlich schlafende Brockoloss – nur eben sehr, sehr alte.',
  spuki:'Verschwindet augenblicklich, sobald man ihm zu nahekommt, und taucht Sekunden später an ganz anderer Stelle wieder auf.',
  spukrator:'Bewegt sich gern durch verlassene Gänge und leere Zimmer. Man hört es eher, als dass man es sieht.',
  spukfuerst:'Alte Legenden aus dem Nebelmoor erzählen von einem Spukfürst, der niemanden je hat gehen lassen, der ihn wirklich gesucht hat.',
  frosti:'Zeigt sich fast ausschließlich, wenn Schnee fällt. Bei klarem Himmel bleibt es tief in seinen Eishöhlen verborgen.',
  frostor:'Formt kleine Eiskristalle allein durch seinen Atem. Kinder in Felsenwacht sammeln sie manchmal als Glücksbringer.',
  frostmonarch:'Soll über den höchsten Gipfeln des Felsenpasses wachen und den ersten Schnee jedes Winters persönlich einleiten.',
  giftling:'Mag es dunkel und feucht und meidet direktes Sonnenlicht, wo es nur kann. Im Nebelmoor fühlt es sich sichtlich am wohlsten.',
  giftkralle:'Seine Berührung hinterlässt einen schwachen, aber unverwechselbaren Geruch nach bitteren Kräutern.',
  giftrex:'Ganze Pfade im Moor gelten als gemieden, seit ein Giftrex dort sein Revier beansprucht hat.',
  flatterix:'Fliegt in schnellen, unberechenbaren Kurven zwischen den Bäumen hin und her und landet selten lange an derselben Stelle.',
  flatterax:'Zieht in kleinen Schwärmen und warnt sich gegenseitig mit hohen Rufen vor Gefahr.',
  flatterlord:'Soll so hoch fliegen können, dass es von unten kaum mehr als ein Schatten am Himmel ist.',
  krabbo:'Gräbt sich bei Ebbe tief in den Sand ein und wartet geduldig auf die nächste Flut.',
  krabbor:'Seine Scheren werden mit jedem Jahr härter – Fischer an der Kristallküste erkennen alte Exemplare an den Kerben darin.',
  krabbolem:'Ein ausgewachsener Krabbolem kann angeblich einen kleinen Fischerkahn allein mit einer Schere anheben.',
  draklin:'Neugierig und wachsam zugleich – es beobachtet Fremde oft lange, bevor es sich zeigt.',
  drakon:'Zieht bevorzugt hoch über Felsgraten seine Bahnen, wo kaum jemand es aus der Nähe sieht.',
  draconar:'Alte Wandmalereien in Höhlen des Felsenpasses zeigen Wesen, die einem Draconar erstaunlich ähnlich sehen.',
  erzling:'Frisst kleine Mengen Mineralgestein und soll dadurch mit der Zeit selbst metallischer werden.',
  erzkralle:'Sein Panzer klirrt leise bei jedem Schritt – manche Minenarbeiter orientieren sich im Dunkeln daran.',
  erzkoloss:'Ganze Stollen im Aschekrater sollen von einem einzigen alten Erzkoloss gegraben worden sein.',
  faustli:'Übt seine Schläge am liebsten an alten Baumstümpfen, bis diese buchstäblich in sich zusammenfallen.',
  fauster:'Trainiert offenbar auch ohne Publikum weiter – Wanderer berichten von dumpfen Schlägen tief aus dem Wald.',
  faustitan:'Ein einziger Schlag soll genügen, um einen ausgewachsenen Baum zu fällen. Niemand testet das freiwillig aus.',
  zwitscherling:'Fliegt in engen Spiralen, als würde es dem Wind nachjagen statt ihm zu folgen. Landet nur, wenn es unbedingt sein muss.',
  sturmvogel:'Zieht Stürmen entgegen statt vor ihnen zu fliehen. Manche Wanderer nutzen es als lebendes Wettersignal.',
  dornkeim:'Wächst dort, wo der Boden am kargsten ist. Die Dornen schützen es lange, bevor es sich überhaupt bewegen kann.',
  dornranke:'Reckt sich meterweit nach Licht, ohne die Wurzeln je zu verlassen. Wer zu nah kommt, spürt die Dornen sofort.',
  dornfuerst:'Ganze Hecken sollen aus einem einzigen Dornfürst gewachsen sein. Was darunter liegt, hat seit Jahren niemand gesehen.',
  kieselknirps:'Übt seine Schläge an Kieselsteinen, bis sie zu Sand zerfallen. Danach sucht es sich einfach den nächsten.',
  felsschlaeger:'Ein Faustschlag reicht, um kleinere Felsbrocken zu zerteilen. Es trainiert trotzdem täglich weiter.',
  bergbrecher:'Soll ganze Geröllfelder allein durch Fauststöße verschoben haben. Niemand stellt sich ihm freiwillig entgegen.',
  schaltling:'Niemand weiß, ob es gebaut oder gewachsen ist. Kleine Funken springen zwischen seinen Zahnrädern, wenn es sich freut.',
  reaktorit:'Der Kern in seiner Mitte glüht ununterbrochen. Manche Werkstätten sollen ganze Maschinenhallen damit betreiben.',
  firnling:'Seine Schuppen bilden sich aus echtem Frost, der selbst im Sommer nicht schmilzt. Junge Tiere sind noch sehr scheu.',
  firndrake:'Sein Atem lässt Wasserdampf sofort zu Eiskristallen gefrieren. Wanderer erkennen seine Nähe am plötzlichen Kälteschauer.',
  lichthirsch:'Zeigt sich fast nur in den ersten Sonnenstrahlen am Morgen. Wer es zu lange ansieht, verliert es aus dem Blick.',
  nesselqualle:'Treibt scheinbar ziellos mit der Strömung, weicht aber jedem Hindernis genau im richtigen Moment aus.',
  schlingling:'Bewegt sich lautlos durchs hohe Gras. Man bemerkt es meist erst, wenn es sich schon wieder zurückgezogen hat.',
  neunschweif:'Alte Geschichten behaupten, jeder einzelne Schweif erinnere sich an ein früheres Leben. Beweisen kann das niemand.',
  wolkenross:'Berührt den Boden nur, wenn es unbedingt muss. Manche Hirten schwören, es in Wolkenformationen wiederzuerkennen.',
  sternross:'Sein Galopp soll in klaren Nächten Lichtspuren am Himmel hinterlassen. Sternschnuppen, sagen manche – nur schneller.',
  rotfell:'Verschwindet zwischen den Bäumen, kaum dass man hinsieht. Manche behaupten, es könne sich in Licht und Schatten auflösen.',
  grimling:'Bleibt nie lange allein, auch wenn kein Rudel in Sicht ist. Irgendwo in der Nähe warten immer weitere.',
  grimmwolf:'Sein Heulen soll über ganze Täler zu hören sein. Andere seiner Art antworten darauf, egal wie weit entfernt sie sind.',
  alphagrimm:'Führt sein Rudel nie mit Kraft allein. Wer ihm nicht mehr folgen will, lässt es ziehen, ohne ein einziges Wort.',
  nattrax:'Bewegt sich fast lautlos, selbst über trockenes Laub. Die meisten merken erst, dass es da war, wenn es längst wieder fort ist.',
  wuestling:'Wandert oft tagelang durch karges Land, ohne sichtbares Ziel. Manche Wanderer folgen ihm – meist finden sie Wasser.',
  wuestenfuerst:'Soll ganze Karawanenrouten kennen, die auf keiner Karte verzeichnet sind. Wer sich verirrt, sucht angeblich seine Spur.',
  giftschlinge:'Seine beiden Köpfe scheinen nicht immer einer Meinung zu sein, wohin es als Nächstes gehen soll.',
  vielhaupt:'Jeder seiner Köpfe wacht abwechselnd, während die anderen ruhen. Ganz allein war es vermutlich noch nie.',
  dreiwart:'Drei Köpfe, ein Wille, sagt man sich. Wer ihm begegnet, hat meist das Gefühl, gleichzeitig aus drei Richtungen beobachtet zu werden.',
  silvarion:'Hüter des Waldes. Man sagt, der gesamte Flüsterwald reagiert auf seine Stimmung – wird er zornig, verdichtet sich der Nebel binnen Minuten.',
  voltrex:'Herr der Stürme. Wo Voltrex erscheint, ziehen binnen Augenblicken Gewitterwolken auf, selbst über der sonst so trockenen Steppe.',
  umbrakor:'Schatten des Moores. Manche behaupten, es sei kein Kryptid im eigentlichen Sinn, sondern das Moor selbst, das eine Gestalt angenommen hat.',
  aeternis:'Wächter der Ewigkeit. Über der Meisterstadt erzählt man sich, Aeternis sei so alt wie die Region selbst – und werde sie überdauern, wenn alles andere vergangen ist.',
  blattmonarch:'Nur ein Blattgigant, das lange genug einen Wurzelkristall bei sich trägt, wächst zu dieser Form heran. Ganze Wälder sollen sich einem Blattmonarch unterordnen.',
  spuktyrann:'Mit einem Seelenanker verschmilzt ein Spukfürst zu etwas Dunklerem. Manche sagen, es habe aufgehört, ein einzelnes Wesen zu sein.',
  nebelwisp:'Ein Rest von etwas Größerem, das sich im Nebelmoor verloren hat. Niemand weiß genau, was es ist – nur, dass es einem folgt, wenn man es einmal gesehen hat.',
  valenor:'Wächter der Krone. Soll seit über 200 Jahren denselben Pfad bewachen, unverändert, während ringsherum ganze Generationen vergingen.'
};
const DEX_ORDER=[];
FAMILIES.forEach(f=>{let c=f;while(c){DEX_ORDER.push(c);c=DEX[c].evo;}});
const FAMILY_OF={};
FAMILIES.forEach(f=>{let c=f;while(c){FAMILY_OF[c]=f;c=DEX[c].evo;}});
// Legendäre: eigene Familie, erscheinen nur an festen Orten
const LEGENDS=['silvarion','voltrex','umbrakor','aeternis'];
LEGENDS.forEach(id=>{DEX_ORDER.push(id);FAMILY_OF[id]=id;});
// Weitere Einzelwesen, die nur als Questbelohnung zu bekommen sind
const SPECIALS=['nebelwisp','valenor'];
SPECIALS.forEach(id=>{DEX_ORDER.push(id);FAMILY_OF[id]=id;});
// Abbilder: kampf-exklusive Erinnerungs-Kopien der vier Legenden, nicht fangbar,
// erscheinen nicht im Katalog - nur Hera besitzt sie.
const ABBILDER=['abbild_silvarion','abbild_voltrex','abbild_umbrakor','abbild_aeternis'];
ABBILDER.forEach(id=>{FAMILY_OF[id]=id;});
const STARTERS=['flamko','aquappi','blattli'];

const LEARNSETS={
  flamko:[[1,'rempler'],[1,'flammenwurf'],[6,'glutstoss'],[10,'krallenhieb'],[14,'glutwelle'],[18,'kampfschrei'],[22,'steinwurf'],[26,'kraftschlag'],[32,'infernoklinge'],[38,'hitzeschild'],[44,'wuchtstoss'],[56,'vulkanherz'],[4,'schockwelle']],
  aquappi:[[1,'rempler'],[1,'wasserstrahl'],[6,'nebelstoss'],[10,'krallenhieb'],[14,'wasserwoge'],[18,'aquaheilung'],[22,'blitzschlag'],[26,'kraftschlag'],[32,'sturmflut'],[38,'schild'],[44,'wuchtstoss'],[56,'flutkrone'],[4,'schockwelle']],
  blattli:[[1,'rempler'],[1,'blattschuss'],[6,'blattsauger'],[10,'krallenhieb'],[14,'blattklinge'],[18,'sporennebel'],[22,'gifthieb'],[26,'kraftschlag'],[32,'urwaldzorn'],[38,'erholung'],[44,'wuchtstoss'],[56,'wurzelgericht'],[4,'schockwelle']],
  zappzap:[[1,'rempler'],[1,'blitzschlag'],[6,'funkenflug'],[10,'krallenhieb'],[14,'donnerschlag'],[18,'donnerwelle'],[22,'eiswind'],[26,'kraftschlag'],[32,'gewittersturm'],[38,'kampfschrei'],[44,'wuchtstoss'],[56,'blitzkaskade'],[4,'schockwelle'],[10,'kettenblitz']],
  brockel:[[1,'rempler'],[1,'steinwurf'],[6,'steinstaub'],[10,'krallenhieb'],[14,'felslawine'],[18,'panzerung'],[22,'flammenwurf'],[26,'kraftschlag'],[32,'bergsturz'],[38,'einschuechtern'],[44,'wuchtstoss'],[56,'erdbeben'],[4,'schockwelle'],[10,'geroellhagel']],
  spuki:[[1,'rempler'],[1,'spukschlag'],[6,'schattenzehr'],[10,'krallenhieb'],[14,'schattenkralle'],[18,'fluch'],[22,'gifthieb'],[26,'kraftschlag'],[32,'seelenriss'],[38,'giftwolke'],[44,'wuchtstoss'],[56,'seelenschrei'],[4,'schockwelle']],
  frosti:[[1,'rempler'],[1,'frostbiss'],[6,'frosthauch'],[10,'krallenhieb'],[14,'eissturm'],[18,'eiswind'],[22,'wasserstrahl'],[26,'kraftschlag'],[32,'gletscherbruch'],[38,'schild'],[44,'wuchtstoss'],[56,'frostkrone'],[4,'schockwelle'],[10,'frostexplosion']],
  giftling:[[1,'rempler'],[1,'giftstachel'],[6,'gifthieb'],[10,'krallenhieb'],[14,'saeurewelle'],[18,'giftwolke'],[22,'schattenzehr'],[26,'kraftschlag'],[32,'toxinflut'],[38,'einschuechtern'],[44,'wuchtstoss'],[56,'giftkrone'],[4,'schockwelle'],[10,'giftnebel']],
  flatterix:[[1,'rempler'],[1,'windstoss'],[6,'einschuechtern'],[10,'luftwirbel'],[14,'sturmflug'],[18,'kampfschrei'],[22,'krallenhieb'],[26,'kraftschlag'],[32,'orkanschlag'],[38,'eiswind'],[44,'wuchtstoss'],[56,'himmelssturz'],[4,'schockwelle']],
  draklin:[[1,'rempler'],[1,'drachenklaue'],[6,'krallenhieb'],[10,'einschuechtern'],[16,'drachenstoss'],[20,'flammenwurf'],[24,'drachentanz'],[28,'kraftschlag'],[34,'drachensturm'],[40,'glutwelle'],[46,'wuchtstoss'],[56,'urzeitatem'],[4,'schockwelle']],
  erzling:[[1,'rempler'],[1,'metallklaue'],[6,'steinstaub'],[10,'krallenhieb'],[15,'stahlschlag'],[19,'stahlpanzer'],[23,'steinwurf'],[28,'kraftschlag'],[33,'erzsturm'],[39,'felslawine'],[45,'wuchtstoss'],[56,'titanschlag'],[4,'schockwelle']],
  faustli:[[1,'rempler'],[1,'fausthieb'],[6,'konter'],[10,'krallenhieb'],[14,'wirbelschlag'],[18,'ausholer'],[22,'steinwurf'],[26,'kraftschlag'],[32,'titanenfaust'],[38,'panzerung'],[44,'wuchtstoss'],[56,'finalfaust'],[4,'schockwelle']],
  zwitscherling:[[1,'rempler'],[1,'windstoss'],[8,'luftwirbel'],[14,'krallenhieb'],[20,'sturmflug'],[28,'orkanschlag'],[36,'sturmschwinge'],[56,'sturmkrone'],[4,'schockwelle']],
  dornkeim:[[1,'gifthieb'],[1,'blattschuss'],[6,'giftstachel'],[12,'blattklinge'],[18,'saeurewelle'],[26,'urwaldzorn'],[32,'toxinflut'],[40,'rankengriff'],[56,'dornengericht'],[4,'schockwelle'],[10,'giftnebel']],
  kieselknirps:[[1,'fausthieb'],[1,'steinwurf'],[6,'wirbelschlag'],[12,'felslawine'],[18,'konter'],[26,'titanenfaust'],[32,'bergsturz'],[40,'urfaust'],[56,'gipfelsturz'],[4,'schockwelle'],[10,'geroellhagel']],
  schaltling:[[1,'metallklaue'],[1,'blitzschlag'],[6,'funkenflug'],[12,'stahlschlag'],[18,'donnerschlag'],[26,'erzsturm'],[32,'donnerlanze'],[40,'stahlkern'],[56,'ueberlastung'],[4,'schockwelle'],[10,'kettenblitz']],
  firnling:[[1,'frostbiss'],[1,'drachenklaue'],[6,'frosthauch'],[12,'eissturm'],[18,'drachenstoss'],[26,'frostnova'],[32,'drachensturm'],[56,'ewigerfrost'],[4,'schockwelle'],[10,'frostexplosion']],
  lichthirsch:[[1,'rempler'],[1,'schild'],[6,'krallenhieb'],[12,'kampfschrei'],[18,'einschuechtern'],[24,'kraftschlag'],[32,'erholung'],[40,'urgewalt'],[56,'morgenlicht'],[4,'schockwelle']],
  nesselqualle:[[1,'wasserstrahl'],[1,'gifthieb'],[6,'nebelstoss'],[12,'giftstachel'],[18,'wasserwoge'],[26,'giftflut'],[34,'flutwelle'],[56,'todesstroemung'],[4,'schockwelle']],
  grimling:[[1,'rempler'],[1,'fausthieb'],[8,'krallenhieb'],[14,'ausholer'],[20,'wirbelschlag'],[28,'kraftschlag'],[4,'schockwelle'],[56,'alphabiss']],
  schlingling:[[1,'gifthieb'],[1,'rempler'],[8,'giftstachel'],[14,'saeurewelle'],[22,'toxinflut'],[4,'schockwelle'],[56,'urgifthauch']],
  wuestling:[[1,'rempler'],[1,'steinwurf'],[8,'krallenhieb'],[14,'felslawine'],[22,'bergsturz'],[4,'schockwelle'],[10,'geroellhagel'],[56,'wuestensturm']],
  rotfell:[[1,'rempler'],[1,'spukschlag'],[8,'krallenhieb'],[14,'schattenkralle'],[22,'seelenriss'],[4,'schockwelle'],[56,'neunschweifzorn']],
  giftschlinge:[[1,'gifthieb'],[1,'drachenklaue'],[8,'saeurewelle'],[14,'drachenstoss'],[22,'toxinflut'],[4,'schockwelle'],[56,'hydragift']],
  dreiwart:[[1,'spukschlag'],[1,'fausthieb'],[8,'schattenkralle'],[14,'konter'],[20,'wirbelschlag'],[28,'seelenriss'],[4,'schockwelle'],[56,'dreifachschlag']],
  wolkenross:[[1,'rempler'],[1,'windstoss'],[8,'krallenhieb'],[14,'luftwirbel'],[22,'orkanschlag'],[4,'schockwelle'],[56,'sternengalopp']],
  silvarion:[[1,'blattklinge'],[1,'krallenhieb'],[1,'sporennebel'],[1,'weltenwurzel']],
  voltrex:[[1,'donnerschlag'],[1,'krallenhieb'],[1,'eiswind'],[1,'sturmzorn']],
  umbrakor:[[1,'schattenkralle'],[1,'gifthieb'],[1,'fluch'],[1,'nachtschlund']],
  aeternis:[[1,'kraftschlag'],[1,'gletscherbruch'],[1,'panzerung'],[1,'ewigkeitsschlag']],
  abbild_silvarion:[[1,'blattklinge'],[1,'krallenhieb'],[1,'sporennebel'],[1,'weltenwurzel']],
  abbild_voltrex:[[1,'donnerschlag'],[1,'krallenhieb'],[1,'eiswind'],[1,'sturmzorn']],
  abbild_umbrakor:[[1,'schattenkralle'],[1,'gifthieb'],[1,'fluch'],[1,'nachtschlund']],
  abbild_aeternis:[[1,'kraftschlag'],[1,'gletscherbruch'],[1,'panzerung'],[1,'ewigkeitsschlag']],
  valenor:[[1,'kronenschlag'],[1,'gletscherbruch'],[1,'stahlpanzer'],[1,'eiswind']],
  krabbo:[[1,'rempler'],[1,'wasserstrahl'],[6,'nebelstoss'],[10,'krallenhieb'],[14,'wasserwoge'],[18,'panzerung'],[22,'frostbiss'],[26,'kraftschlag'],[32,'sturmflut'],[38,'schild'],[44,'wuchtstoss'],[56,'panzerbrecher'],[4,'schockwelle']]
};

// ============================ ITEMS ============================
const ITEMS={
  trank:{name:'Trank',desc:'+45 KP',price:200,kind:'heal',amount:45},
  supertrank:{name:'Supertrank',desc:'+120 KP',price:500,kind:'heal',amount:120},
  beleber:{name:'Beleber',desc:'belebt mit 50% KP',price:900,kind:'revive'},
  gegenmittel:{name:'Gegenmittel',desc:'heilt Statusprobleme',price:150,kind:'cure'},
  fokussplitter:{name:'Fokussplitter',desc:'Füllt die AP einer Attacke auf',price:750,kind:'ap',scope:'move'},
  urtonikum:{name:'Ur-Tonikum',desc:'Füllt alle AP eines Kryptids komplett auf',price:0,kind:'ap',scope:'all'},
  ueberreste:{name:'Überreste',desc:'Tragitem: +7% KP pro Runde',price:1200,kind:'held',effect:'regen'},
  machtband:{name:'Machtband',desc:'Tragitem: +15% Schaden',price:1500,kind:'held',effect:'macht'},
  schutzstein:{name:'Schutzstein',desc:'Tragitem: -15% erlittener Schaden',price:1500,kind:'held',effect:'schutz'},
  schnellfeder:{name:'Schnellfeder',desc:'Tragitem: +25% Initiative',price:1300,kind:'held',effect:'schnell'},
  fokusgurt:{name:'Fokusgurt',desc:'Tragitem: übersteht einen Treffer bei vollen KP',price:1800,kind:'held',effect:'fokus'},
  heilkraut:{name:'Heilkraut',desc:'Tragitem: heilt einmal 40% bei wenig KP',price:1600,kind:'held',effect:'heilkraut'},
  wurzelkristall:{name:'Wurzelkristall',desc:'Seltenes Tragitem: lässt einen Blattgigant beim nächsten Level-Up zum Blattmonarch erwachen.',price:0,kind:'held',effect:'evo'},
  seelenanker:{name:'Seelenanker',desc:'Seltenes Tragitem: lässt einen Spukfürst beim nächsten Level-Up zum Spuktyrann verschmelzen.',price:0,kind:'held',effect:'evo'},
  // --- Schriftrollen: nur passender Typ kann sie lernen ---
  r_pflanze:{name:'Rolle: Rankengriff',desc:'Nur für Pflanze-Kryptiden',price:0,kind:'scroll',move:'rankengriff',forType:'Pflanze'},
  r_geist:{name:'Rolle: Seelenfeuer',desc:'Nur für Geist-Kryptiden',price:0,kind:'scroll',move:'seelenfeuer',forType:'Geist'},
  r_wasser:{name:'Rolle: Flutwelle',desc:'Nur für Wasser-Kryptiden',price:0,kind:'scroll',move:'flutwelle',forType:'Wasser'},
  r_elektro:{name:'Rolle: Donnerlanze',desc:'Nur für Elektro-Kryptiden',price:0,kind:'scroll',move:'donnerlanze',forType:'Elektro'},
  r_feuer:{name:'Rolle: Feuersturm',desc:'Nur für Feuer-Kryptiden',price:0,kind:'scroll',move:'feuersturm',forType:'Feuer'},
  r_gift:{name:'Rolle: Giftflut',desc:'Nur für Gift-Kryptiden',price:0,kind:'scroll',move:'giftflut',forType:'Gift'},
  r_stein:{name:'Rolle: Erdstoß',desc:'Nur für Stein-Kryptiden',price:0,kind:'scroll',move:'erdstoss',forType:'Stein'},
  r_eis:{name:'Rolle: Frostnova',desc:'Nur für Eis-Kryptiden',price:0,kind:'scroll',move:'frostnova',forType:'Eis'},
  r_licht:{name:'Rolle: Lichtlanze',desc:'Für jede Kryptide · trifft immer',price:0,kind:'scroll',move:'lichtlanze',forType:null},
  r_sturm:{name:'Rolle: Sturmruf',desc:'Für jede Kryptide · steigert Initiative',price:0,kind:'scroll',move:'sturmruf',forType:null},
  r_ader:{name:'Rolle: Aderlass',desc:'Nur für Geist-Kryptiden',price:0,kind:'scroll',move:'aderlass',forType:'Geist'},
  r_kampf:{name:'Rolle: Berserkerschlag',desc:'Nur für Kampf-Kryptiden',price:0,kind:'scroll',move:'urfaust',forType:'Kampf'},
  r_flug:{name:'Rolle: Sturmklinge',desc:'Nur für Flug-Kryptiden',price:0,kind:'scroll',move:'sturmschwinge',forType:'Flug'},
  r_drache:{name:'Rolle: Drachenodem',desc:'Nur für Drache-Kryptiden',price:0,kind:'scroll',move:'urdrache',forType:'Drache'},
  r_metall:{name:'Rolle: Stahlbrecher',desc:'Nur für Metall-Kryptiden',price:0,kind:'scroll',move:'stahlkern',forType:'Metall'},
  r_all:{name:'Rolle: Urgewalt',desc:'Für jede Kryptide',price:0,kind:'scroll',move:'urgewalt',forType:null},
  bindungsstein:{name:'Bindungsstein',desc:'Einfacher Bindungsversuch',price:120,kind:'ball',mult:1},
  vertrauensstein:{name:'Vertrauensstein',desc:'Stärkere Bindungschance',price:350,kind:'ball',mult:1.6},
  ahnenstein:{name:'Ahnenstein',desc:'Uralte, kraftvolle Verbindung',price:800,kind:'ball',mult:2.4},
  glutstein:{name:'Glutstein',desc:'Schwingt stark mit Feuer-Kryptiden mit',price:280,kind:'ball',mult:1,matchType:'Feuer',matchMult:2.8},
  flutstein:{name:'Flutstein',desc:'Schwingt stark mit Wasser-Kryptiden mit',price:280,kind:'ball',mult:1,matchType:'Wasser',matchMult:2.8},
  wurzelstein:{name:'Wurzelstein',desc:'Schwingt stark mit Pflanze-Kryptiden mit',price:280,kind:'ball',mult:1,matchType:'Pflanze',matchMult:2.8},
  funkenstein:{name:'Funkenstein',desc:'Schwingt stark mit Elektro-Kryptiden mit',price:280,kind:'ball',mult:1,matchType:'Elektro',matchMult:2.8},
  schleierstein:{name:'Schleierstein',desc:'Schwingt stark mit Geist-Kryptiden mit',price:280,kind:'ball',mult:1,matchType:'Geist',matchMult:2.8},
  kernstein:{name:'Kernstein',desc:'Schwingt stark mit Stein-Kryptiden mit',price:280,kind:'ball',mult:1,matchType:'Stein',matchMult:2.8},
  kronensplitter:{name:'Kronensplitter',desc:'Ein Bruchstück von etwas Uraltem. Warm, obwohl es nichts wärmt.',price:0,kind:'relic'}
};
const SHOP_STOCK=['trank','supertrank','beleber','gegenmittel','fokussplitter','bindungsstein','vertrauensstein','ahnenstein',
  'glutstein','flutstein','wurzelstein','funkenstein','schleierstein','kernstein',
  'ueberreste','machtband','schutzstein','schnellfeder','fokusgurt','heilkraut'];
const heldEffect=m=>(m&&m.held&&ITEMS[m.held]&&ITEMS[m.held].kind==='held')?ITEMS[m.held].effect:null;

// ============================ KARTEN ============================
// T=Baum/Fels W=Wasser .=Gras ,=hohes Gras P=Weg H=Rasthaus G=Tor
// K=Holzbrücke O=Stein U=Busch M=Blumenwiese V=Hügel L=Lava (neue organische Terrain-Tiles)
const MAPS=[
 {rows:['TTTTTTTTTTTTTTTTTTTTTT','T.........GG.........T','T...VV,,,.PP.....VV..T','T.TT..,,,.PP.........T','T.TT......PP..WW..O..T','T.T...MMM.PP..WW.....T','TCPPPPPPPPPPP.WW.....T','T.....MOM.PPP.WWWW...T','T.........PPPPPKKPW..T','T.TT.P....PP..WW.WW..T','T.TTUPM..PPP..WWWWW..T','T.T..P...PP...WW.,,,.T','T....CVV.PP...WW.,,,.T','T...TTU..PP..........T','T..,T,...PPP.........T','T..,,,...PPP.........T','T.........PP.........T','TTTTTTTTTTTTTTTTTTTTTT'],
  spawn:[10,16],trainers:[[4,4],[17,4],[5,9],[16,9],[8,13]],boss:[10,2],rival:[13,13]},
 {rows:['TTTTTTTTTTTTTTTTTTTTTT','T.........PP.........T','T.TT......PP.....TTT.T','T.TTT..,,,PP...O..TT.T','T.T....O,,PPP........T','T....U.,,,PPP..U.....T','T.........PPP...U.TT.T','T.TT..O...PP......TT.T','T.TT.....PPP.........T','TCPPPPPPPPP......T...T','T...T.P..PPPP........T','T.....P..PPPP,,,..TT.T','T.TT..M...PPP,,,..T..T','T.T..U....PP..,,.....T','T........PPP....TT...T','T...TT,,.PP..........T','T....,,,.PPS.........T','TTTTTTTTTTTTTTTTTTTTTT'],
  spawn:[10,16],trainers:[[4,4],[17,4],[6,9],[15,10],[8,13]],boss:[10,2],rival:[13,13],legend:[19,15]},
 {rows:['TTTTTTTTTTTTTTTTTTTTTT','T.........PP.........T','T.....,,,.PP.....O...T','T.....,,,.PP.O.WWWWW.T','T.WWW....PPP...WWWWW.T','T.WWW.U..PP...UWWWWW.T','T.WWW....PPP...WWWWW.T','T.....MM.PPP..KKKWWW.T','T..O..MM..PPP.KKKWWW.T','T....MM...PPP..WWWWW.T','T..U......PPP..WWWWW.T','T.WWW.....PP...WWWWW.T','T.WWW.U..PPP...WWWWW.T','T.WWW.,,,PP....WWWWW.T','T.....,,,PPP.O.WWWWW.T','TCPPPPPPPPPPP..WWWWW.T','T.........PP.........T','TTTTTTTTTTTTTTTTTTTTTT'],
  spawn:[10,16],trainers:[[5,4],[13,4],[5,10],[13,9],[6,13]],boss:[10,2],rival:[12,12]},
 {rows:['TTTTTTTTTTTTTTTTTTTTTT','T.........PP.........T','T.....,,,.PP.,,,,....T','T...VV,,,.PP.,,,,VV..T','T.....U,,.PP.,,O,....T','T.........PP.........T','T.........PP.........T','T..O.....VPPPP....O..T','T.........PPPP.......T','T.........PPPP.......T','T.........PPV........T','T........PPP....,,,,.T','T.,,,,...PP.....VV,,.T','T.,,VV...PPP...U,,,,.T','T.,,,,O..PPP....,,,,.T','T.,,,,....PPPPPPPPPPCT','T.........PP.........T','TTTTTTTTTTTTTTTTTTTTTT'],
  spawn:[10,16],trainers:[[5,4],[16,4],[3,9],[18,9],[6,13]],boss:[10,2],rival:[15,12],legend:[2,13]},
 {rows:['TTTTTTTTTTTTTTTTTTTTTT','T.........PP.........T','TCPPPPPPPPPP.........T','T.O.......PP.......O.T','T..O......PP...LL.O..T','T......O..PP...LLLL..T','T.........PP...LLLL..T','T..LLLL...PP.........T','T..LLLL...PPP........T','T..LLLL...PPP........T','T........PPPP........T','T........PPP..LLL.L..T','T.......PPP...LLLLL..T','T.......PP....LLLLL..T','T...O...PPPP.......O.T','T.O.....PPPP.O.......T','T.........PP.........T','TTTTTTTTTTTTTTTTTTTTTT'],
  spawn:[10,16],trainers:[[4,4],[17,4],[8,6],[13,6],[4,11]],boss:[10,2],rival:[17,11]},
 {rows:['TTTTTTTTTTTTTTTTTTTTTT','T.........PP.........T','T..,,,....PP.........T','T..,,,....PP.O.......T','T..,,,...PPP....OO...T','T..WWWW..PP.....O....T','T..WWWKK.PPPP........T','T..WWWW..PPPP.....U..T','T.........PPP........T','TCPPPPPPPPPP...WWWW..T','T...OO..PPPP...KKWW..T','T...O...PPP....WWWW..T','T.......PPPP...WWW...T','T.....U.OPPP...,,,,..T','T........PPP..U,,,,..T','T........PP....,,,,..T','T........PPS.........T','TTTTTTTTTTTTTTTTTTTTTT'],
  spawn:[10,16],trainers:[[3,3],[18,3],[7,6],[14,6],[3,12]],boss:[10,2],rival:[18,12],legend:[2,15]},
 {rows:['TTTTTTTTTTTTTTTTTTTTTT','T.........PP.........T','T.........PP.........T','T.TT...VV.PP......TT.T','T.T......PPP..WWW..T.T','T.....O..PP...WKKO...T','T........PPP..WWWW...T','T...TT...PPP..WWWW...T','T.........PPP........T','T.........PPP........T','T........PPPP...TT...T','T........PPP.........T','T.TT....PPP.......TT.T','T.......PPPPPPPPPPPPCT','T...O...PPPP.........T','T.......PPPP.........T','T.........PP.........T','TTTTTTTTTTTTTTTTTTTTTT'],
  spawn:[10,16],trainers:[[4,4],[17,4],[8,6],[13,6],[4,11]],boss:[10,2],rival:[17,11]},
 {rows:['TTTTTTTTTTTTTTTTTTTTTT','T.........PP.........T','T.........PPPPPPPPPPCT','T..O......PP......O..T','T.........PP.........T','T........VPPV........T','T.........PP.........T','T.....O...PP...O.....T','T.........PP.........T','T.........PP.........T','T.....O..PPP...O.....T','T........PP..........T','T........VP.V........T','T........PPP.........T','T..O.....PPP......O..T','T.........PP.........T','T.........PP.........T','TTTTTTTTTTTTTTTTTTTTTT'],
  spawn:[10,16],trainers:[[10,14],[6,11],[14,11],[6,5],[14,5]],boss:null,rival:null,legend:[2,11]}
];

// ---- Stadt (je Gebiet ein eigener Grundriss & Thema) ----
// B=Gebäudewand H=Rasthaus A=Arena N=Nordausgang S=Südausgang P=Weg .=Boden T=Rand
const CITY_DEFS=[
 {rows:['TTTTTTTTTTTTTTTTTTTTTT','T.........NN.........T','T.........PP.........T','T..BBBBB..PP...BBBBB.T','T..BBBBB..PP...BBBBB.T','T..BBHBB..PP...BABBB.T','T....PP...PP....PP...T','T....PP...PP....PP...T','T...UPP...PP....PU...T','T....PP...PP....PP...T','T.PPPPPPPPPPPPPPPPPPPT','T.PPPPPPPPPPPPPPPPPP.T','T.WWWWWWWWKKWWWWWWWW.T','T.........PP.........T','T.....M..MPPM..M.....T','T..U......PP......U..T','T.........SS.........T','TTTTTTTTTTTTTTTTTTTTTT'],
  doorH:[5,5],doorA:[16,5],npcs:[[4,9],[17,9],[7,14],[14,14]]},
 {rows:['TTTTTTTTTTTTTTTTTTTTTT','T.........NN.........T','T.........PP.........T','T.TBBBBB..PP...BBBBT.T','T.TBBBBB..PP...BBBBT.T','T..BBHBB..PP...BABBB.T','T....PP...PP....PP...T','T...UPP...PP....PU...T','T....PP...PP....PP...T','T....PP...PP....PP...T','T.PPPPPPPPPPPPPPPPPPPT','T.PPPPPPPPPPPPPPPPPP.T','T...U.....PP.....U...T','T.T......MPPM......T.T','T.T.......PP.......T.T','T.........PP.........T','T.........SS.........T','TTTTTTTTTTTTTTTTTTTTTT'],
  doorH:[5,5],doorA:[16,5],npcs:[[4,9],[17,9],[7,14],[14,14]]},
 {rows:['TTTTTTTTTTTTTTTTTTTTTT','T.........NN.........T','T.........PP.........T','T..BBBBB..PP..BBBBB..T','T..BBBBB..PP..BBBBB..T','T..BBHBB..PP..BABBB..T','T....PP...PP...PP....T','T....PP...PP...PP....T','T....PP...PP...PP....T','T....PP...PP...PP....T','T.PPPPPPPPPPPPPPPWWWPT','T.PPPPPPPPPPPPPPKWWW.T','T.........PP....KWWW.T','T...O.....PP....KWWW.T','T...O.....PP....KWWW.T','T.........PP.....WWW.T','T.........SS.........T','TTTTTTTTTTTTTTTTTTTTTT'],
  doorH:[5,5],doorA:[15,5],npcs:[[4,9],[13,9],[7,14],[15,13]]},
 {rows:['TTTTTTTTTTTTTTTTTTTTTT','T.........NN.........T','T.........PP.........T','T..BBBBB..PP...BBBBB.T','T..BBBBB..PP...BBBBB.T','T..BBHBB..PP...BABBB.T','T....PP...PP....PP...T','T....PP...PP....PP...T','T..V.PP...PP....PPV..T','T....PP...PP....PP...T','T.PPPPPPPPPPPPPPPPPPPT','T.PPPPPPPPPPPPPPPPPP.T','T.........PP.........T','T..V......PP......V..T','T.........PP.........T','T.........PP.........T','T.........SS.........T','TTTTTTTTTTTTTTTTTTTTTT'],
  doorH:[5,5],doorA:[16,5],npcs:[[4,9],[17,9],[7,14],[14,14]]},
 {rows:['TTTTTTTTTTTTTTTTTTTTTT','T.........NN.........T','T.........PP.........T','T..BBBBB..PP...BBBBB.T','T..BBBBB..PP...BBBBB.T','T..BBHBB..PP...BABBB.T','T....PP...PP....PP...T','T....PP...PP....PP...T','T..O.PP...PP....PPO..T','T....PP...PP....PP...T','T.PPPPPPPPPPPPPPPPPPPT','T.PPPPPPPPPPPPPPPPPP.T','T.........PP.........T','T..LL.....PP.....LL..T','T.........PP.........T','T.........PP.........T','T.........SS.........T','TTTTTTTTTTTTTTTTTTTTTT'],
  doorH:[5,5],doorA:[16,5],npcs:[[4,9],[17,9],[7,14],[14,14]]},
 {rows:['TTTTTTTTTTTTTTTTTTTTTT','T.........NN.........T','T.........PP.........T','T..BBBBB..PP...BBBBB.T','T..BBBBB..PP...BBBBB.T','T..BBHBB..PP...BABBB.T','T....PP...PP....PP...T','T....PO...PP...OPP...T','T....PP...PP....PP...T','T....PP...PP....PP...T','T.PPPPPPPOPPOPPPPPPPPT','T.PPPPPPPPPPPPPPPPPP.T','T.........PP.........T','T.....O...PP...O.....T','T.........PP.........T','T.........PP.........T','T.........SS.........T','TTTTTTTTTTTTTTTTTTTTTT'],
  doorH:[5,5],doorA:[16,5],npcs:[[4,9],[17,9],[7,14],[14,14]]},
 {rows:['TTTTTTTTTTTTTTTTTTTTTT','T.........NN.........T','T.........PP.........T','T..BBBBB..PP...BBBBB.T','T..BBBBB..PP...BBBBB.T','T..BBHBB..PP...BABBB.T','T....PP...PP....PP...T','T....PP...PP....PP...T','T....PP...PP....PP...T','T....PP...PP....PP...T','T.PPPPPPPPPPPPPPPPPPPT','T.PPPPPPPPPPPPPPPPPP.T','T........WWWW........T','T..O.....WWWW.....O..T','T........WWWW........T','T.........PP.........T','T.........SS.........T','TTTTTTTTTTTTTTTTTTTTTT'],
  doorH:[5,5],doorA:[16,5],npcs:[[4,9],[17,9],[3,15],[18,15]]},
 {rows:['TTTTTTTTTTTTTTTTTTTTTT','T.........NN.........T','T.........PP.........T','T..BBBBB..PP...BBBBB.T','T..BBBBB..PP...BBBBB.T','T..BBHBB..PP...BABBB.T','T....PP...PP....PP...T','T....PP...PP....PP...T','T...OPP...PP....PO...T','T....PP..OPPO...PP...T','T.PPPPPPPPPPPPPPPPPPPT','T.PPPPPPPPPPPPPPPPPP.T','T.........PP.........T','T...O.....PP.....O...T','T.........PP.........T','T.........PP.........T','T.........SS.........T','TTTTTTTTTTTTTTTTTTTTTT'],
  doorH:[5,5],doorA:[16,5],npcs:[[4,9],[17,9],[7,14],[14,14]]}
];
// ---- Arena (Innenraum) ----
// F=Boden D=Ausgang B=Wand
const ARENA_DEFS=[
 {rows:['BBBBBBBBBBBBBBBBBBBBBB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFYYFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFBBFFFFBBFFFFFB','BFFFFFFFZFFFFFFZFFFFFB','BFFFFFFFFFFZFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFDDFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BBBBBBBBBBBBBBBBBBBBBB'],
  pos:[[6,14],[15,14],[6,10],[15,10],[10,6]],boss:[10,2]},
 {rows:['BBBBBBBBBBBBBBBBBBBBBB','BFFFFFFFFFFFFFFFFFFFFB','BFBBBBBBBFFBBBBBBBBFFB','BFBFFFFFBFFBFFFFFFBFFB','BFBFBBBFBFFBFBBBBBBFFB','BFBFBFFFBFFBFBFFFFFFFB','BFBFBFBBBBFBFBFBBBBFFB','BFBFBFFFFFFBFBFFFFBFFB','BFBFBBBBBBFBFBBBBBFFFB','BFBFFFFFFFFBFFFFFFFFFB','BFBBBBBBBBBBBBBBBBBFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFDDFFFFFFFFFB','BBBBBBBBBBBBBBBBBBBBBB'],
  pos:[[6,14],[15,14],[6,3],[15,3],[10,11]],boss:[10,2]},
 {rows:['BBBBBBBBBBBBBBBBBBBBBB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFQQQQQQQQQQQQQQQFFFB','BFFQQQQQQQQQQQQQQQFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFRRRRRRRRRRRRRRRFFFB','BFFRRRRRRRRRRRRRRRFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFDDFFFFFFFFFB','BBBBBBBBBBBBBBBBBBBBBB'],
  pos:[[6,14],[15,14],[6,3],[15,3],[10,12]],boss:[10,2]},
 {rows:['BBBBBBBBBBBBBBBBBBBBBB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFF^B','BFFFFFFFFFFFFFFFFFFF^B','BFFFFFFFFFFFFFFFFFFF^B','BFFFFFFFFFFFFFFFFFFF^B','BFFFFFFFFFFFFFFFFFFF^B','BFFFFFFFFFFFFFFFFFFF^B','BFFFFFFFFFFFFFFFFFFF^B','BFFFFFFFFFFFFFFFFFFF^B','BFFFFFFFFFFFFFFFFFFF^B','B>>>>>>>>>>>>>>>>>>>^B','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFDDFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BBBBBBBBBBBBBBBBBBBBBB'],
  pos:[[6,14],[15,14],[6,10],[15,10],[10,6]],boss:[10,2]},
 {rows:['BBBBBBBBBBBBBBBBBBBBBB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFqqqqqqqqqqqqqqqFFFB','BFFqqqqqqqqqqqqqqqFFFB','BFFqqqqqqqqqqqqqqqFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFrrrrrrrrrrrrrrrFFFB','BFFrrrrrrrrrrrrrrrFFFB','BFFrrrrrrrrrrrrrrrFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFDDFFFFFFFFFB','BBBBBBBBBBBBBBBBBBBBBB'],
  pos:[[6,14],[15,14],[6,3],[15,3],[10,12]],boss:[10,2]},
 {rows:['BBBBBBBBBBBBBBBBBBBBBB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BBBBBBBBBEBBBBBBBBBBFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFJFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BBBBBBBBBBBBEBBBBBBBBB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFJFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFDDFFFFFFFFFB','BBBBBBBBBBBBBBBBBBBBBB'],
  pos:[[6,14],[15,14],[6,10],[15,10],[10,6]],boss:[10,2]},
 {rows:['BBBBBBBBBBBBBBBBBBBBBB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BIIIIIIIIIIIIIIIIIIIIB','BIIIIIIIIIIIIIIIIIIIIB','BIIIIIIFIIIIIIIFIIIIIB','BIIIIIIIIIIIIIIIIIIIIB','BIIIIFIIIIIIIIIIFIIIIB','BIIIIIIIIIIIIIIIIIIIIB','BIIIIIIIFIIIFIIIIIIIIB','BIIIIIIIIIIIIIIIIIIIIB','BIIIIFIIIIIIIIIIFIIIIB','BIIIIIIIIIIIIIIIIIIIIB','BIIIIIIIIIIIIIIIIIIIIB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFDDFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BBBBBBBBBBBBBBBBBBBBBB'],
  pos:[[6,14],[15,14],[6,10],[15,10],[10,6]],boss:[10,2]},
 {rows:['BBBBBBBBBBBBBBBBBBBBBB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFOFFFFFFFFOFFFFFB','BFFIIIIIIIIIIIIIIIIFFB','BFFIIIIIIIIIIIIIIIIFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFOFFFFFFFFOFFFFFB','BFFQQQQQQQQQQQQQQQFFFB','BFFQQQQQQQQQQQQQQQFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFOFFOFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFFFFFFFFFFFFB','BFFFFFFFFFDDFFFFFFFFFB','BBBBBBBBBBBBBBBBBBBBBB'],
  pos:[[10,14],[6,11],[14,11],[6,2],[14,2]],boss:[10,2]}
];


// ---- Routen entstehen aus den alten Karten ----
const ROUTES=MAPS.map((m,i)=>({
  rows:m.rows.map((r,y)=>{
    let t=r.replace(/H/g,'.');
    if(y===1)t=t.slice(0,10)+'NN'+t.slice(12);
    if(y===16)t=t.slice(0,10)+'SS'+t.slice(12);
    return t;
  }),
  trainers:m.trainers, rival:m.rival, legend:m.legend
}));
const SPAWN_SUED=[10,15], SPAWN_NORD=[10,2];
// Zwei Routen verlangen, dass man den dortigen Nebenbereich abgeschlossen hat, bevor es weitergeht.
const LORE_GATES={
  2:{foundKey:'side:kristallkueste_wrack:10:10',
     msg:'Im Gestrandeten Wrack liegt noch etwas Wichtiges. Ein Wasser-Kryptid an deiner Seite hilft dir, die Ladeluke zu öffnen.'},
  4:{foundKey:'side:aschekrater_schmiede:11:9',
     msg:'In der Verlassenen Schmiede wartet noch ein Kronensplitter. Ein Feuer-Kryptid an deiner Seite bringt die alte Esse wieder zum Glühen.'}
};
// Prolog: Startdorf + Verbindungsroute, existieren AUSSERHALB der 8 nummerierten Gebiete
const PROLOGUE_TOWN={
  name:'Lichthausen',
  rows:['TTTTTTTTTTTTTTTTTTTTTT','T.........NN.........T','T.........PP.........T','T...BBBBB.PP.........T','T...BBBBB.PP.........T','T...BBHBB.PP.........T','T....PP...PP.........T','T....PP...PP.........T','T.........PP.........T','T.........PPPPPPPPPPCT','T.........PP.........T','T.........PP.........T','T.........PP.........T','T.........PP.........T','T.........PP.........T','T.........PP.........T','T.........PP.........T','TTTTTTTTTTTTTTTTTTTTTT']
};
const PROLOGUE_ROUTE={
  rows:['TTTTTTTTTTTTTTTTTTTTTT','T.........NN.........T','T...,,..........,,...T','T..,,,..........,....T','T..,,,..........,,...T','T....................T','T......,,....,,......T','T......,,....,,......T','T....................T','T....................T','T....,,........,,....T','T....,,........,,....T','T....................T','T....................T','T....................T','T.........SS.........T','T....................T','TTTTTTTTTTTTTTTTTTTTTT'],
  trainers:[
    {key:'pro-0',pos:[13,9],name:'Wanderer Milo',team:[{id:'flatterix',lvl:4}],
     intro:'Wanderer Milo: "Hey! Lust auf eine erste Übungsrunde?"',
     win:'Wanderer Milo: "Nicht schlecht für den Anfang!"'},
    {key:'pro-1',pos:[9,3],name:'Kräutersammlerin Nora',team:[{id:'blattli',lvl:3}],
     intro:'Kräutersammlerin Nora: "Vorsicht, mein Blattli mag es nicht, wenn man seine Kräuter zertritt!"',
     win:'Kräutersammlerin Nora: "Na gut, du darfst weiter."'},
    {key:'pro-2',pos:[10,7],name:'Angler Theo',team:[{id:'aquappi',lvl:5}],
     intro:'Angler Theo: "Warte kurz – bevor du weiterziehst, zeig mir doch, was du drauf hast."',
     win:'Angler Theo: "Alle Achtung. Sag Fabian, ich hab nach ihm gefragt."'},
    {key:'pro-3',pos:[17,12],name:'Geschwisterkind Piet',team:[{id:'zappzap',lvl:6}],
     intro:'Geschwisterkind Piet: "Meine Schwester meint, ich soll noch üben. Machst du mit?"',
     win:'Geschwisterkind Piet: "Uff. Ich übe noch ein bisschen weiter."'}
  ]
};
const PROLOGUE_NPCS=[
  {n:'Dorfältester Ruben',pos:[15,9],
   t:['Willkommen in Lichthausen, Reisende·r.',
      'Im hohen Gras unterwegs können dir freilebende Kryptiden begegnen – und wachsen, je mehr sie mit dir erleben.',
      'Fabian kennt sich mit alten Bräuchen hier besser aus als ich. Sprich am besten mit ihm.']},
  {n:'Fabian',key:'fabian-intro',pos:[9,7],
   t:['Oh – hallo! Du bist wohl neu hier. Ich bin Fabian.',
      'Ich beschäftige mich schon lange mit der Bindung zwischen uns und Kryptiden. Es ist... mehr als nur Zähmen, weißt du?',
      'Es gibt eine alte Tradition hier: die Bindungswiese, im Osten des Dorfes. Dort warten junge Kryptiden, die noch keinen Weggefährten gefunden haben.',
      'Man wählt dort nicht wirklich selbst – man lässt sich finden. Das Ritual entscheidet, nicht du allein.',
      'Komm, ich zeig dir den Weg. Es ist nicht weit.']}
];
// Kleine Dörfer, direkt in die Route eingebettet (kein eigener Bildschirm) -
// Zwischenstopps mit eigenem kleinen Charakter statt Mini-Städten.
// Echte Verzweigungen: zusätzliche Trainer, die es nur auf dem Umweg gibt (nicht in der Halle).
const ROUTE_FORK_TRAINERS={
  1:[{key:'fork-1-0',pos:[3,11],name:'Bücherwurm Tilda',kind:'normal',smart:false,
      team:[{id:'spuki',lvl:16},{id:'giftling',lvl:17}],pal:TR_PALS[2],lvl:17,
      intro:'Bücherwurm Tilda: "Wer den Umweg nimmt, hat sich schon fast für ein Abenteuer entschieden!"',
      win:'Bücherwurm Tilda: "Na gut, das hätte ich nicht erwartet."'}],
  3:[{key:'fork-3-0',pos:[18,12],name:'Muschelsammler Enno',kind:'normal',smart:false,
      team:[{id:'krabbo',lvl:22},{id:'nesselqualle',lvl:23}],pal:TR_PALS[4],lvl:23,
      intro:'Muschelsammler Enno: "Hier an der Bucht findet man die interessantesten Sachen – auch Gegner."',
      win:'Muschelsammler Enno: "Alles klar, ich geh zurück zu meinen Muscheln."'}],
  6:[{key:'fork-6-0',pos:[5,9],name:'Nebelläufer Kaspar',kind:'normal',smart:false,
      team:[{id:'rotfell',lvl:41},{id:'giftschlinge',lvl:42}],pal:TR_PALS[1],lvl:42,
      intro:'Nebelläufer Kaspar: "Im Nebel verirrt sich kaum wer hierher. Umso besser."',
      win:'Nebelläufer Kaspar: "Der Nebel hat wohl heute nicht mich beschützt."'}],
};
const ROUTE_NPCS={
  1:[
    {n:'Wegweiser',pos:[8,2],
     t:['Hier teilt sich der Pfad. Nach Westen geht’s direkter, aber wenig zu sehen.',
        'Nach Osten dauert’s länger – dafür trifft man dort eher auf andere Reisende.']}
  ],
  4:[
    {n:'Rastwirt Toma',pos:[2,10],
     t:['Aschehain nennen wir das hier – mehr Rastplatz als Dorf, aber der Tee ist gut.',
        'Karawanen halten hier immer eine Nacht, bevor sie sich in die Hitze des Kraters wagen.']},
    {n:'Karawanenführerin Iyla',pos:[6,10],
     t:['Ich führe seit Jahren Reisende durch die Gluthitze. Ohne eine Pause hier schafft es kaum wer.',
        'Der direkte Weg durch die Lava-Felder ist schneller, aber du merkst schon, warum die meisten den Umweg nehmen.']}
  ],
  2:[
    {n:'Fischerin Tamsin',pos:[2,9],
     t:['Willkommen in Gezeitendorf. Klein, salzig, aber unseres.',
        'Bei Ebbe findet man manchmal die seltsamsten Sachen zwischen den Felsen.']},
    {n:'Netzflicker Bode',pos:[5,7],
     t:['Die Kristallbucht ist von hier aus nicht mehr weit. Aber lass dir Zeit, hier ist es auch schön.',
        'Meine Großmutter hat schon hier gelebt, als Kristallbucht noch kein Hafen war, nur ein paar Hütten.']}
  ]
};

// ---- Stadtnamen ----
const ARENA_TR_NAMES=[
 ['Hallenwache Ben','Prüferin Ina','Wächter Rolf','Kämpferin Sue','Veteran Ove'],
 ['Waldwache Tord','Prüfer Elm','Wächterin Bea','Jägerin Nia','Veteran Ulf'],
 ['Hafenwache Sten','Prüferin Mia','Wächter Jorn','Taucherin Ea','Veteran Kai'],
 ['Steppenwache Rok','Prüfer Van','Wächterin Ida','Reiterin Lo','Veteran Bran'],
 ['Glutwache Zed','Prüferin Ash','Wächter Korr','Schmiedin Fee','Veteran Drax'],
 ['Nebelwache Wyn','Prüfer Mor','Wächterin Sil','Seherin Ora','Veteran Gral'],
 ['Felswache Urd','Prüfer Stein','Wächterin Berg','Kletterin Ea','Veteran Thal'],
 ['','','','','']
];
const CITY_NAMES=['Mooshain','Flüsterfurt','Kristallbucht','Donnerfeste',
  'Ascheort','Nebelhalt','Felsenwacht','Meisterstadt'];
const ARENA_NAMES=['Mooshalle','Waldhalle','Küstenhalle','Steppenhalle',
  'Kraterhalle','Moorhalle','Felsenhalle','Liga-Halle'];

// ---- Bewohner: Tipps, Geschenke, Schriftrollen ----
const NPC_DATA=[
 [{n:'Alte Marta',t:['Willkommen in Mooshain!','Im Rasthaus links wirst du geheilt – und kannst einkaufen.','Die Halle rechts prüft, ob du zum Weiterziehen bereit bist.'],quest:'q9',
   chat:['Wenn du mal Hunger hast, klopf einfach – ich hab immer Suppe auf dem Herd.','Ich lebe schon mein ganzes Leben in Mooshain. Hier ändert sich wenig, und das ist auch gut so.']},
  {n:'Junge Nele',t:['Feuer schlägt Pflanze, Wasser schlägt Feuer, Pflanze schlägt Wasser.','Merk dir das, dann gewinnst du fast jeden Kampf am Anfang.'],quest:'q0',
   chat:['Ich übe jeden Tag die Typen-Tabelle, bis ich sie im Schlaf kann.','Manchmal wünsche ich mir, mutiger zu sein wie du.']},
  {n:'Händler Kurt',t:['Nimm das, für den Anfang.','Halt den Stein erst hin, wenn der Gegner kaum noch Kraft hat.'],gift:'vertrauensstein',n2:3,
   chat:['Ware kommt und geht, aber gute Preise bleiben.','Ich habe schon in jeder Stadt der Region gehandelt – Mooshain ist mein Lieblingsplatz.']},
  {n:'Wanderer Ove',t:['Auf dem Weg nach Norden warten Trainer.','Sie sind stärker als das, was im Gras herumläuft.'],
   chat:['Ich ziehe nie lange an einem Ort. Aber Mooshain hat es mir angetan.','Pack genug Tränke ein, bevor du losziehst.']}],
 [{n:'Förstersfrau Ida',t:['Der Wald verschluckt Geräusche – und manchmal ganze Kryptiden.','Geist-Attacken prallen an Normal-Kryptiden völlig ab. Umgekehrt genauso.'],
   chat:['Ich kenne fast jeden Baum in diesem Wald beim Namen.','Der Wald redet mit einem, wenn man lange genug zuhört.']},
  {n:'Kräutersammler Jo',t:['Hier, gegen Gift und Lähmung.','Statusprobleme verschwinden nicht von selbst im Kampf.'],gift:'gegenmittel',n2:3,quest:'q10',
   chat:['Die besten Kräuter wachsen dort, wo kaum wer hinsieht.','Gegen fast alles wächst hier ein Kraut – man muss es nur finden.']},
  {n:'Schreiber Anselm',t:['Ich habe eine alte Rolle gefunden. Für dich.','Lichtlanze verfehlt niemals ihr Ziel. Das ist mehr wert, als es klingt.'],gift:'r_licht',n2:1,quest:'q1',
   chat:['Ich sammle jede Seite, jedes Fragment, das ich finde.','Manche Bücher sind wichtiger als ganze Bibliotheken.']},
  {n:'Kind Pim',t:['Im hohen Gras verstecken sich manchmal scheue Kryptiden!','Die hauen nach zwei Runden ab. Man muss schnell sein.'],
   chat:['Ich habe mal ein Spuki gesehen! Ehrlich!','Erzähl mir, wenn du dich mit was Seltenem verbündet hast, ja?']}],
 [{n:'Kapitänin Wilma',t:['Bei uns regnet es fast immer.','Regen macht Wasser-Attacken stärker und Feuer schwächer. Denk dran.'],
   chat:['Ich war schon in jedem Sturm auf See, den es gibt.','Ohne Regen wäre die Bucht nur halb so schön.']},
  {n:'Taucher Ben',t:['Krabbo ist Wasser und Stein zugleich.','Doppeltypen erben beide Schwächen – Pflanze trifft die doppelt hart.'],
   chat:['Unter Wasser ist es stiller als überall sonst.','Ich tauche am liebsten bei Sonnenaufgang, wenn noch keiner wach ist.']},
  {n:'Netzflickerin Ru',t:['Für die weite Reise.','Tragitems sind mehr wert als ein Trank. Sie wirken jede Runde.'],gift:'ueberreste',n2:1,
   chat:['Ein Netz zu flicken dauert länger, als man denkt – aber es lohnt sich.','Jedes Loch im Netz ist ein Fisch, der entkommt.']},
  {n:'Alter Seebär',t:['Attacken haben Punkte. Sind die leer, bleibt nur ein müder Stoß.','Im Rasthaus füllen sie sich wieder auf.'],quest:'q2',
   chat:['Ich erzähl die Geschichte vom Riesenwesen jedem, der stehen bleibt.','Früher war ich selbst mal so jung und ungeduldig wie du.']}],
 [{n:'Reiterin Hanne',t:['Der Sandsturm hier stärkt Stein und schwächt Pflanze.','Wer sich auskennt, wählt sein Team danach.'],
   chat:['Ich reite lieber gegen den Wind als mit ihm – man lernt mehr dabei.','Meine Kryptiden sind schneller als jedes Pferd.']},
  {n:'Bogner Falk',t:['Elektro trifft Flug hart. Pflanze steckt es dagegen weg.','Viele glauben das Gegenteil – und verlieren.'],
   chat:['Ich übe jeden Morgen, bevor die Sonne die Steppe aufheizt.','Ein guter Schuss braucht Geduld, keine Kraft.']},
  {n:'Späherin Yun',t:['Nimm den. Er macht deine Kryptide schneller.','Wer zuerst schlägt, gewinnt oft, bevor es eng wird.'],gift:'schnellfeder',n2:1,quest:'q3',
   chat:['Ich sehe Dinge kommen, lange bevor andere sie bemerken.','Geschwindigkeit gewinnt öfter als Stärke, glaub mir.']},
  {n:'Hirte Bo',t:['Ein Kampf hat höchstens vier Attacken zur Auswahl.','Nimm nicht vier vom selben Typ. Deckung ist alles.'],
   chat:['Meine Herde kennt die Steppe besser als ich.','Ruhe ist hier draußen mehr wert als Gold.']}],
 [{n:'Schmiedin Runa',t:['Hier, für harte Zeiten.','Ein Machtband macht jeden Angriff spürbar härter.'],gift:'machtband',n2:1,quest:'q4',
   chat:['Das Feuer in meiner Esse geht nie ganz aus.','Ich schmiede nur, was auch hält – keine halben Sachen.']},
  {n:'Aschegräber Tom',t:['Metall-Kryptiden halten fast alles aus.','Aber Feuer und Kampf brechen ihren Panzer.'],
   chat:['In der Asche findet man manchmal mehr, als man erwartet.','Metall-Kryptiden mag ich am liebsten – zäh wie ich.']},
  {n:'Wirtin Cara',t:['Die Halle hier verlangt mehr Herausforderer als anderswo.','Je weiter du kommst, desto länger der Weg zum Hallenmeister.'],
   chat:['Bei mir ist immer ein Platz frei, auch wenn es voll aussieht.','Ich habe schon so manchen müden Trainer wieder aufgepäppelt.']},
  {n:'Bote Nils',t:['Man kann zurückgehen, weißt du?','Der Südausgang bringt dich auf den Weg, den du gekommen bist.'],
   chat:['Ich bring Nachrichten schneller als jeder Vogel.','Der Südausgang bringt dich übrigens genau dahin zurück, wo du herkamst.']}],
 [{n:'Seherin Alma',t:['Nimm diese Rolle, Wanderer.','Sturmruf steigert die Initiative. Keine andere Attacke tut das.'],gift:'r_sturm',n2:1,
   chat:['Ich sehe mehr im Nebel, als mir manchmal lieb ist.','Manche Dinge sollte man nicht zu genau wissen wollen.']},
  {n:'Moorkundiger Veit',t:['Nebel stärkt Geist und schwächt Normal.','Hier unten kämpft es sich anders als überall sonst.'],
   chat:['Ich kenne jeden festen Weg durchs Moor – die anderen meide ich.','Der Nebel hier lügt nie, er zeigt nur nicht alles auf einmal.']},
  {n:'Irrlicht-Jäger Ru',t:['Vergiftung frisst jede Runde an den Kräften.','Gegen zähe Gegner ist das oft besser als roher Schaden.'],
   chat:['Ich jage die Lichter schon seit Jahren – verbündet hat sich noch keins mit mir.','Manche sagen, die Irrlichter jagen eigentlich mich.']},
  {n:'Grufti Odo',t:['Für die Geister unter deinen Freunden.','Aderlass saugt mehr Leben als jede andere Attacke.'],gift:'r_ader',n2:1,quest:'q5',
   chat:['Ich habe mein Leben dem Nebel gewidmet, im Guten wie im Schlechten.','Manche Geschichten sind wahrer, als man glauben will.']}],
 [{n:'Bergwacht Silke',t:['Schneetreiben stärkt Eis und schwächt Pflanze.','Über den Pass kommt nur, wer vorbereitet ist.'],
   chat:['Ich kenne fast jede Lawine, bevor sie kommt.','Der Pass verzeiht keine Unvorsicht, das lernt man schnell.']},
  {n:'Steinmetz Gorm',t:['Nimm den Schutzstein. Du wirst ihn brauchen.','Was danach kommt, verzeiht keine Fehler mehr.'],gift:'schutzstein',n2:1,quest:'q6',
   chat:['Ich schlage Stein, seit ich denken kann.','Manche Statuen hier oben sind älter als die Stadt selbst.']},
  {n:'Kletterin Mai',t:['In der Halle warten fünf Herausforderer vor dem Meister.','Heil dich vorher. Es gibt keine Pause dazwischen.'],
   chat:['Ich bin höher geklettert, als die meisten für möglich halten.','Der Ausblick von ganz oben ist jede Mühe wert.']},
  {n:'Alter Wirt',t:['Hinter dem Pass liegt die Meisterstadt.','Dort endet jede Reise – so oder so.'],
   chat:['Ich habe schon Hunderte auf dem Weg zur Meisterstadt durchziehen sehen.','Nicht alle sind zurückgekommen, um mir davon zu erzählen.']}],
 [{n:'Torwächterin Vala',t:['Die Liga-Halle nimmt nur Meister auf.','Fünf Meister, keine Pause. Deine AP füllen sich nicht zwischendurch.'],
   chat:['Ich habe schon viele an dieser Tür scheitern sehen.','Nur wer wirklich bereit ist, kommt an mir vorbei.']},
  {n:'Chronist Aldo',t:['Ich schreibe auf, wer die Liga bezwingt.','Bisher ist die Liste kurz.'],quest:'q7',
   chat:['Ich schreibe jeden Namen auf, der es hierher schafft.','Meine Liste ist kürzer, als man denken würde.']},
  {n:'Heilerin Sona',t:['Nimm das. Weiter kann ich dir nicht helfen.','Ab hier zählt nur noch dein Team.'],gift:'ahnenstein',n2:5,
   chat:['Ab hier heile ich niemanden mehr – das übernimmst du selbst.','Ich hoffe, dein Team ist bereit für das, was kommt.']},
  {n:'Rivale Kai',t:['Also hast du es doch bis hierher geschafft.','Ich bin vor dir dran. Aber danach... viel Glück.'],
   chat:['Ich hol dich noch ein, das schwöre ich dir.','Diesmal lasse ich dir keinen Vorsprung.']}]
];

// ---- Kleine Gespräche für wiederholte Besuche: Gerüchte, Legenden, Tipps ----
const CHAT_POOLS=[
 ['Die Pilze im Unterholz sollen bei Vollmond leuchten – gesehen hat es noch niemand, aber alle schwören drauf.',
  'Manchmal hört man morgens Glöckchen im Nebel über der Wiese. Die Alten nennen es das Läuten der Wichtel.',
  'Der kleine Bach hinter dem Dorf soll nie zufrieren, selbst im tiefsten Winter nicht.',
  'Wer genau hinschaut, findet manchmal frische Fährten im hohen Gras. Was da wohl durchgezogen ist?'],
 ['Im Nebel verliert man leicht die Richtung. Manche Wanderer erzählen, der Wald selbst verschiebe die Wege.',
  'Nachts hört man ein Flüstern zwischen den Bäumen – daher der Name, sagt man.',
  'Alte Schriftrollen wie die von Anselm sollen überall im Unterholz verstreut liegen, wenn man nur sucht.',
  'Manche Kryptiden hier zeigen sich nur, wenn niemand hinschaut. Typisch Geist-Art.'],
 ['Der Leuchtturm brennt jede Nacht, auch wenn längst niemand mehr dort wohnt.',
  'Bei Regen beißen die Wasser-Kryptiden besonders gut, sagen die Fischer.',
  'Manche Muscheln am Strand sollen von versunkenen Schiffen stammen – niemand hat es je bewiesen.',
  'Ein alter Seebär erzählt jedem, der es hören will, von einer Sturmflut vor Jahren.'],
 ['Die alten Windmühlen drehen sich, auch wenn kein Wind geht. Erklären kann es dir keiner.',
  'Der Sandsturm hier kommt manchmal ohne Vorwarnung. Halt dich an den Wegmarkierungen.',
  'Reiterin Hanne behauptet, sie kenne jeden Grashalm in der Steppe beim Namen.',
  'In klaren Nächten sieht man von den Hügeln aus bis zum Meer, heißt es.'],
 ['Die Schmiede hier arbeitet Tag und Nacht – das Feuer im Krater geht nie aus.',
  'Manche sagen, tief unten im Gestein schlummert etwas Uraltes.',
  'Bei Sonnenschein werden die Feuer-Kryptiden hier fast unbezwingbar, pass auf.',
  'Der Aschestaub soll Glück bringen, wenn er dir auf die Schultern fällt. Oder Pech. Man ist sich nicht einig.'],
 ['Im Nebelmoor verirrt sich mancher – und manche kommen nie zurück, heißt es.',
  'Die Irrlichter über dem Moor sollen verlorene Seelen sein. Folg ihnen besser nicht.',
  'Grufti Odo kennt angeblich jede Ruine hier, zumindest behauptet er das.',
  'Nachts wird es hier unheimlich still. Selbst die Geist-Kryptiden schweigen dann.'],
 ['Über den Pass kommt nur, wer den Schnee nicht fürchtet.',
  'In den Höhlen hier soll es Gänge geben, die niemand je ganz erkundet hat.',
  'Steinmetz Gorm behauptet, er hätte einst eine Legende mit bloßen Händen aus dem Fels geschlagen.',
  'Wenn der Wind über die Grate pfeift, klingt es fast wie Gesang.'],
 ['Nur wer alle sieben Hallen bezwungen hat, betritt diesen Ort.',
  'Man erzählt sich, Champion Vera habe noch nie einen Kampf verloren.',
  'Die Liga-Halle wurde vor Generationen erbaut – aus Stein, der aus jeder Region stammt.',
  'Wer hier antritt, kämpft nicht nur gegen Meister, sondern gegen die eigenen Zweifel.']
];

const AREA_DEFS=[
  {name:'Mooswiese',cap:12,style:{grass:'#8fce7a',grass2:'#83c46e',tall:'#5faa52',tall2:'#4e9648',path:'#e2cda6',water:'#4a7fc1',tree:'#2e6338',tree2:'#3c7a46',trunk:'#5a4632',sky1:'#bfe6f5',sky2:'#8fce7a'},
   roster:['flamko','aquappi','blattli','flatterix','dornkeim','lichthirsch','grimling'],boss:'Wiesenwart Bruno',ambient:['fireflies','leaves','butterflies']},
  {name:'Flüsterwald',cap:18,style:{grass:'#79b869',grass2:'#6fae5f',tall:'#4e9648',tall2:'#3f7d3a',path:'#cdb488',water:'#3f6fa8',tree:'#245028',tree2:'#2e6338',trunk:'#4a3826',sky1:'#a8ceb0',sky2:'#79b869'},
   roster:['blattli','spuki','giftling','flatterix','dornkeim','lichthirsch','grimling','schlingling'],boss:'Waldläuferin Mira',ambient:['fog','rays','leaves']},
  {name:'Kristallküste',cap:24,style:{grass:'#8fd0b8',grass2:'#84c6ae',tall:'#4aa88c',tall2:'#3f9a7e',path:'#ece0b8',water:'#3f92c9',tree:'#2e7a68',tree2:'#3a8a76',trunk:'#6a5a44',sky1:'#bfeaf5',sky2:'#8fd0b8'},
   roster:['aquappi','krabbo','zappzap','frosti','nesselqualle','giftschlinge'],boss:'Küstenkapitän Sören',weather:'regen',ambient:['rain']},
  {name:'Donnersteppe',cap:30,style:{grass:'#cfc684',grass2:'#c4ba78',tall:'#a89a4a',tall2:'#988a3e',path:'#e2ceA0',water:'#4a7fc1',tree:'#7a7040',tree2:'#8a8050',trunk:'#5a4632',sky1:'#f0dfa8',sky2:'#cfc684'},
   roster:['zappzap','flatterix','faustli','flamko','zwitscherling','schaltling','wolkenross'],boss:'Steppenreiterin Ilka',weather:'sturm',ambient:['dust','butterflies']},
  {name:'Aschekrater',cap:36,style:{grass:'#c98a6a',grass2:'#bd8060',tall:'#a85a3a',tall2:'#984e30',path:'#8a6a55',water:'#c25a3a',tree:'#6a4030',tree2:'#7a4c38',trunk:'#4a2c20',sky1:'#e8a878',sky2:'#c98a6a'},
   roster:['flamko','brockel','erzling','faustli','kieselknirps','schaltling','wuestling'],boss:'Kraterhexe Glut',weather:'sonne',ambient:['ash','rays']},
  {name:'Nebelmoor',cap:42,style:{grass:'#8a86b0',grass2:'#807ca6',tall:'#5a568c',tall2:'#4e4a7e',path:'#6f6a94',water:'#4a4a7a',tree:'#3a3660',tree2:'#46426e',trunk:'#2e2a48',sky1:'#a8a4c8',sky2:'#8a86b0'},
   roster:['spuki','giftling','draklin','frosti','nesselqualle','firnling','schlingling','rotfell','giftschlinge'],boss:'Moorgeist Nebula',weather:'nebel',ambient:['fog','irrlichter']},
  {name:'Felsenpass',cap:48,style:{grass:'#b8ae98',grass2:'#aca28c',tall:'#8a7f6d',tall2:'#7a6f5d',path:'#cfbfa0',water:'#5a8ab8',tree:'#6a6050',tree2:'#7a7060',trunk:'#4a4238',sky1:'#d8cfc0',sky2:'#b8ae98'},
   roster:['brockel','erzling','draklin','faustli','kieselknirps','zwitscherling','firnling','wuestling','wolkenross'],boss:'Felsvogt Granit',weather:'schnee',ambient:['snow']},
  {name:'Liga der Meister',cap:60,style:{grass:'#6a5f86',grass2:'#605578',tall:'#463c66',tall2:'#3e3459',path:'#544a70',water:'#3a3060',tree:'#302848',tree2:'#3a3054',trunk:'#241e38',sky1:'#8a7fa8',sky2:'#6a5f86'},
   roster:FAMILIES,bosses:['Meisterin Aria','Meister Kwon','Meisterin Vega','Meister Oberon','Champion Vera'],ambient:['rays']}
];
const TR_NAMES=[
  ['Schüler Tim','Wanderin Lea','Angler Udo','Sammlerin Fee','Azubi Nils'],
  ['Förster Ben','Kräuterhexe Roh','Späher Kai','Jägerin Nora','Pilzsucher Ole'],
  ['Matrose Finn','Taucherin Ada','Fischerin Ilse','Seebär Rolf','Lotsin Maja'],
  ['Reiter Jost','Nomadin Suki','Falkner Ivo','Läuferin Tara','Hirte Wim'],
  ['Schmied Balu','Glühfaust Ren','Kohle-Kim','Aschejäger Vito','Funkenfee Zoe'],
  ['Mystiker Ash','Seherin Runa','Irrlicht Pim','Nebelnixe Wen','Grufti Odo'],
  ['Kletterer Gus','Steinbeißer Ur','Bergwacht Ida','Höhlenfex Bo','Geologin Mel'],
  []
];

// ============================ MONSTER ============================
function speciesForLevel(base,lvl){let c=base;while(DEX[c].evo&&lvl>=DEX[c].evoLvl)c=DEX[c].evo;return c;}
// Manche Entwicklungen (z.B. Quest-Belohnungen) brauchen zusätzlich ein bestimmtes Tragitem
function canEvolve(p){
  const d=DEX[p.id];
  if(!d.evo||p.level<d.evoLvl)return false;
  if(d.evoItem&&p.held!==d.evoItem)return false;
  return true;
}
function movesForLevel(id,lvl){
  const set=LEARNSETS[FAMILY_OF[id]]||LEARNSETS.flamko;const ids=[];
  set.forEach(p=>{if(p[0]<=lvl&&ids.indexOf(p[1])<0)ids.push(p[1]);});
  return ids.slice(-4);
}
function statsFor(id,lvl,shiny){
  const b=DEX[id].base,bonus=shiny?1.1:1;
  return{maxHp:Math.floor((20+lvl*b[0]/7)*bonus),atk:Math.floor((5+lvl*b[1]/9)*bonus),
    def:Math.floor((5+lvl*b[2]/9)*bonus),spd:Math.floor((5+lvl*b[3]/9)*bonus)};
}
function apFor(moves){return moves.map(id=>MOVES[id]?moveAP(MOVES[id]):10);}
function makeMonster(id,lvl,shiny){
  shiny=shiny||false;
  const s=statsFor(id,lvl,shiny);
  const mv=movesForLevel(id,lvl);
  return{id,level:lvl,shiny,maxHp:s.maxHp,hp:s.maxHp,atk:s.atk,def:s.def,spd:s.spd,
    xp:0,xpNext:lvl*45,moves:mv,ap:apFor(mv),status:null,statusTurns:0};
}
// AP auffüllen (Rasthaus, Heilung)
function restoreAP(m){m.ap=apFor(m.moves);}
function apOf(m,i){
  if(!m.ap||m.ap.length!==m.moves.length)m.ap=apFor(m.moves);
  return m.ap[i];
}
function maxAPof(m,i){const mo=MOVES[m.moves[i]];return mo?moveAP(mo):10;}
function refreshStats(m){
  const s=statsFor(m.id,m.level,m.shiny);
  const diff=s.maxHp-(m.maxHp||s.maxHp);
  const ohnmaechtig=(m.hp!=null&&m.hp<=0);
  m.maxHp=s.maxHp;
  if(ohnmaechtig)m.hp=0;                              // niemals von selbst aufstehen
  else m.hp=Math.max(0,Math.min(m.maxHp,(m.hp==null?s.maxHp:m.hp)+Math.max(0,diff)));
  m.atk=s.atk;m.def=s.def;m.spd=s.spd;
}
const mName=m=>(m.shiny?'✨':'')+(m.nick||DEX[m.id].name);
const artName=m=>DEX[m.id].name;
const mType=m=>DEX[m.id].type;
const mTypes=m=>DEX[m.id].type2?[DEX[m.id].type,DEX[m.id].type2]:[DEX[m.id].type];
const typeBadges=m=>mTypes(m).map(t=>badge(t)).join(' ');
const mMoves=m=>m.moves.map(i=>MOVES[i]).filter(Boolean);

// ============================ ZUSTAND ============================
const state={team:[],box:[],leadIdx:0,bag:{bindungsstein:5,trank:2},money:600,
  seen:[],caught:[],defeated:[],rivals:[],legends:[],found:[],scrolls:[],npcGifts:[],
  events:[],npcSeen:[],legendClues:[],quests:{},sideId:null,legendCluePity:{},citiesVisited:[],facing:[0,1],
  pendingLearn:[],pendingEvo:[],area:0,loc:'stadt',px:10,py:15,
  champion:false,mode:'title',healed:false,battle:null,dexRewards:[]};

const $=id=>document.getElementById(id);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const areaDef=()=>AREA_DEFS[state.area];
const badge=(t,txt)=>`<span class="badge" style="background:${TYPE_COLORS[t]}">${txt||t}</span>`;
const hpCls=p=>p<=.2?'hp-fill critical':p<=.5?'hp-fill low':'hp-fill';
let lastMsgLen=0,skipFn=null;
const setMsg=t=>{
  const el=$('msgBox');
  el.innerHTML=t;
  lastMsgLen=String(t).replace(/<[^>]*>/g,'').length;
};
// Wartet lesegerecht – ein Tipp auf den Textkasten springt weiter
function readPause(extra){
  const ms=Math.min(3400,Math.max(750,620+lastMsgLen*26))+(extra||0);
  return new Promise(res=>{
    let done=false;
    const el=$('msgBox');
    const finish=()=>{
      if(done)return;done=true;
      clearTimeout(timer);skipFn=null;
      el.classList.remove('waiting');
      res();
    };
    el.classList.add('waiting');
    const timer=setTimeout(finish,ms);
    skipFn=finish;
  });
}
const lead=()=>state.team[state.leadIdx];

function showScreen(n){
  ['intro','title','world','battle','team','dex','shop'].forEach(s=>$('screen-'+s).classList.toggle('hidden',s!==n));
  state.mode=n;
}
let toastT=null;
function toast(t,ms){const el=$('worldToast');el.innerHTML=t;el.classList.add('show');
  clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),ms||2400);}

// ============================ TRAINER ============================
function genTeam(roster,lvl,size){
  const t=[];for(let i=0;i<size;i++){
    const b=roster[rnd(0,roster.length-1)],L=Math.max(2,lvl-rnd(0,2));
    t.push({id:speciesForLevel(b,L),lvl:L});}
  return t;
}
// Trainingslager auf Route 8: eigene, typgebundene Ausbilder statt der Liga-Meister,
// damit man die Champions nicht versehentlich vorab auf der Route "verbraucht"
// (sie nutzten früher dieselben Schlüssel wie die Liga-Halle-Meister – echter Bug).
const LIGA_ROUTE_TRAINERS_DEF=[
  {n:'Feuer-Ausbilderin Rana',roster:['flamko'],
   intro:'Feuer-Ausbilderin Rana grinst: "Wer die Hitze nicht erträgt, hat in der Liga nichts verloren."',
   win:'Feuer-Ausbilderin Rana: "Gut durchgeglüht. Weiter geht\'s."'},
  {n:'Wasser-Ausbilder Fynn',roster:['aquappi'],
   intro:'Wasser-Ausbilder Fynn bleibt gelassen: "Ruhig wie das Wasser, tödlich wie die Flut. Zeig mir deine Ruhe."',
   win:'Wasser-Ausbilder Fynn: "Nicht schlecht. Die Flut hat dich nicht mitgerissen."'},
  {n:'Pflanzen-Ausbilderin Mai',roster:['blattli'],
   intro:'Pflanzen-Ausbilderin Mai lächelt geduldig: "Geduld ist die stärkste Waffe, die ich kenne. Beweis mir deine."',
   win:'Pflanzen-Ausbilderin Mai: "Gut gewurzelt. Du bist bereit für mehr."'},
  {n:'Elektro-Ausbilder Dax',roster:['zappzap'],
   intro:'Elektro-Ausbilder Dax funkt schon ungeduldig: "Schnelligkeit entscheidet mehr Kämpfe als Kraft. Los!"',
   win:'Elektro-Ausbilder Dax: "Blitzschnell. Respekt."'},
  {n:'Gestein-Ausbilder Bor',roster:['brockel','erzling'],
   intro:'Gestein-Ausbilder Bor stellt sich breit hin: "Ich bin das Letzte, was zwischen dir und der Liga steht. Zeig mir, ob du bereit bist."',
   win:'Gestein-Ausbilder Bor: "Fest wie Fels. Die Liga wartet auf dich."'}
];
function ligaRouteTrainers(){
  const mp=MAPS[7],cap=AREA_DEFS[7].cap;
  return LIGA_ROUTE_TRAINERS_DEF.map((d,i)=>{
    const lvl=48+i*3;
    return{key:'7route-'+i,pos:mp.trainers[i],name:d.n,kind:i===4?'boss':'normal',smart:true,
      dbl:i===4,team:genTeam(d.roster,lvl,i===4?5:3),pal:TR_PALS[i%5],lvl:lvl,
      intro:d.intro,win:d.win};
  });
}
const BOSS_FLAVOR={
  0:{intro:'Wiesenwart Bruno gießt gerade seine Blumenbeete und blickt auf: "Ah, ein neues Gesicht! Zeig mir, was in dir steckt – aber pass auf meine Blumen auf."',
     win:'Wiesenwart Bruno: "Hehe, stark! Genau wie meine Kürbisse in diesem Jahr. Zieh weiter, das Tor ist offen."'},
  1:{intro:'Waldläuferin Mira löst sich lautlos aus dem Nebel: "Ich kenne jeden Pfad in diesem Wald. Zeig mir, ob du auch im Kampf so sicher bist."',
     win:'Waldläuferin Mira: "Nicht schlecht. Der Wald hat dich angenommen – das Tor gibt dich frei."'},
  2:{intro:'Küstenkapitän Sören mustert dich wie eine aufziehende Welle: "Ich hab schon Stürme überstanden, die größer waren als du. Zeig mir, was du kannst!"',
     win:'Küstenkapitän Sören: "Har! Respekt. Die See gibt den Weg frei – und ich auch."'},
  3:{intro:'Steppenreiterin Ilka lässt den Wind durch ihr Haar fahren: "Wer die Steppe durchqueren will, muss schneller sein als der Sturm. Bist du das?"',
     win:'Steppenreiterin Ilka: "Schnell und stark. Der Wind trägt dich weiter – das Tor ist offen."'},
  4:{intro:'Kraterhexe Glut blickt kaum von ihren brodelnden Tiegeln auf: "Noch jemand, der meine Forschung stört. Na gut – beweis mir wenigstens, dass es sich lohnt."',
     win:'Kraterhexe Glut: "Interessant... sehr interessant. Du hast dir das Tor redlich verdient."'},
  5:{intro:'Moorgeist Nebula erhebt sich aus dem Nebel wie eine alte Erzählung: "Viele kommen hierher, auf der Suche nach Legenden. Wenige verdienen es, eine zu werden."',
     win:'Moorgeist Nebula: "Deine Geschichte wird man sich erzählen. Zieh weiter, Wanderer."'},
  6:{intro:'Felsvogt Granit stemmt sich vor den Weg wie ein Fels selbst: "Der Pass gehört nur denen, die so unerschütterlich sind wie der Stein. Beweise es."',
     win:'Felsvogt Granit: "Fest wie Granit. Der Pass ist frei – geh mit Bedacht weiter."'}
};
const LIGA_FLAVOR=[
  {intro:'Meisterin Aria verbeugt sich mit einem Lächeln: "Ein Kampf ist wie ein Tanz – lass uns sehen, ob du den Takt hältst."',
   win:'Meisterin Aria: "Wundervoll getanzt. Du hast dir die nächste Runde verdient."'},
  {intro:'Meister Kwon verschränkt die Arme: "Disziplin schlägt Talent. Zeig mir deine."',
   win:'Meister Kwon: "Diszipliniert gekämpft. Ich erkenne es an."'},
  {intro:'Meisterin Vega mustert dich kühl: "Ich habe deine bisherigen Kämpfe studiert. Mal sehen, ob die Daten stimmen."',
   win:'Meisterin Vega: "Meine Berechnungen lagen daneben. Selten, aber es passiert."'},
  {intro:'Meister Oberon breitet die Arme aus: "Willkommen zur größten Show der Liga – mit mir in der Hauptrolle!"',
   win:'Meister Oberon: "Bravo! Ein würdiger Mitspieler für meine Bühne."'},
  {intro:'Champion Vera senkt kurz den Blick, dann sieht sie dir fest in die Augen: "Du hast einen langen Weg hinter dir. Zeig mir, ob er dich auch stark gemacht hat."',
   win:'Champion Vera: "...Du hast gewonnen. Ehrlich verdient. Von nun an bist du die neue Champion."'}
];
const AREAS=AREA_DEFS.map((d,a)=>{
  const mp=MAPS[a],trainers=[];
  if(a<7){
    for(let s=0;s<5;s++){
      const lvl=Math.max(3,d.cap-7+s*2),size=Math.min(3,1+Math.floor(a/3)+(s>=3?1:0));
      const trDbl=(s===3)&&(a===1||a===3||a===6);
      trainers.push({key:a+'-'+s,pos:mp.trainers[s],name:TR_NAMES[a][s],kind:'normal',smart:a>=4,
        dbl:trDbl,team:genTeam(d.roster,lvl,Math.max(trDbl?2:1,size)),pal:TR_PALS[s%5],lvl:lvl,
        intro:TR_NAMES[a][s]+': "Auf zum Kampf!"',win:TR_NAMES[a][s]+': "Stark gespielt!"'});
    }
    const bossSize=4+Math.floor(a/3);
    trainers.push({key:a+'-boss',pos:mp.boss,name:d.boss,kind:'boss',smart:true,dbl:((a+1)%3===0),
      team:Array.from({length:bossSize},(_,i)=>{
        const b=d.roster[i%d.roster.length];
        const L=d.cap-(i>=bossSize-2?0:i>=bossSize-4?1:2);
        return{id:speciesForLevel(b,Math.max(2,L)),lvl:Math.max(2,L)};}),pal:BOSS_PAL,lvl:d.cap,
      intro:(BOSS_FLAVOR[a]&&BOSS_FLAVOR[a].intro)||(d.boss+' versperrt das Tor: "Nur wer mich besiegt, zieht weiter!"'),
      win:(BOSS_FLAVOR[a]&&BOSS_FLAVOR[a].win)||(d.boss+': "Beeindruckend! Das Tor ist offen."')});
  }else{
    d.bosses.forEach((nm,i)=>{
      const lvl=d.cap-8+i*2,sh=FAMILIES.slice().sort(()=>Math.random()-.5);
      const size=(i===4)?6:4;
      const bonus=(i===4)?2:1;   // Champion Vera ist deutlich stärker
      trainers.push({key:a+'-'+i,pos:mp.trainers[i],name:nm,kind:'boss',smart:true,dbl:(i===2||i===4),
        team:Array.from({length:size},(_,k)=>{
          const L=lvl+bonus-(k>=size-2?0:1);
          return{id:speciesForLevel(sh[k%sh.length],L),lvl:L};}),
        pal:BOSS_PAL,lvl:lvl,intro:(LIGA_FLAVOR[i]&&LIGA_FLAVOR[i].intro)||(nm+': "Zeig mir, ob du der Liga würdig bist!"'),
        win:(LIGA_FLAVOR[i]&&LIGA_FLAVOR[i].win)||(nm+': "Respekt... du bist besser als ich."')});
    });
  }
  return Object.assign({},d,{trainers,map:mp});
});
const LEGEND_DATA={
  1:{id:'silvarion',title:'Hüter des Waldes',
     intro:'Ein uraltes Rauschen erfüllt die Lichtung...<br><b>SILVARION</b>, Hüter des Waldes, erwacht!'},
  3:{id:'voltrex',title:'Herr der Stürme',
     intro:'Der Himmel reißt auf...<br><b>VOLTREX</b>, Herr der Stürme, stellt sich dir!'},
  5:{id:'umbrakor',title:'Schatten des Moores',
     intro:'Die Nebel weichen zurück...<br><b>UMBRAKOR</b>, Schatten des Moores, erhebt sich!'},
  7:{id:'aeternis',title:'Wächter der Ewigkeit',
     intro:'Ein Licht ohne Ursprung erscheint...<br><b>AETERNIS</b>, Wächter der Ewigkeit, prüft dich!'}
};
// Hinweisketten: erst Gerücht + Spuren + Licht/Geräusch, dann erscheint das legendäre Kryptid
const LEGEND_RUMORS={
  1:'Manche behaupten, tief im Flüsterwald wache etwas Uraltes über die Bäume – SILVARION, wie die Alten es nennen.',
  3:'Wenn der Himmel über der Steppe aufreißt, sprechen die Reiter von VOLTREX, dem Herrn der Stürme.',
  5:'Im tiefsten Nebelmoor soll ein Schatten leben, den man UMBRAKOR nennt. Die meisten meiden diesen Teil des Moors.',
  7:'Ganz oben, wo kein Pfad mehr hinführt, soll AETERNIS wachen – der Wächter der Ewigkeit selbst.'
};
const LEGEND_CLUE_TEXT={
  1:{spuren:'👣 Riesige, uralte Fährten ziehen sich zwischen den Bäumen hindurch...',
     licht:'✨ Ein grünliches Glimmen huscht durchs Unterholz und ist im nächsten Moment verschwunden.'},
  3:{spuren:'👣 Tief in die Erde gepresste Abdrücke – als hätte hier ein gewaltiges Wesen gestanden, während der Sturm tobte.',
     licht:'⚡ Ein greller Blitz zuckt aus heiterem Himmel, ohne jeden Donner.'},
  5:{spuren:'👣 Schleifspuren im Schlamm, so groß wie ein ganzer Körper. Sie verlieren sich im Nebel.',
     licht:'👻 Ein violetter Schimmer schwebt kurz über dem Moor, dann verschluckt ihn die Dunkelheit.'},
  7:{spuren:'👣 Ein Abdruck im uralten Stein, zu groß für irgendein bekanntes Wesen.',
     licht:'🌟 Ein Licht ohne erkennbare Quelle erhellt für einen Herzschlag die ganze Halle.'}
};
const LEGEND_CLUE_KINDS=['geruecht','spuren','licht'];
function legendClueCount(a){
  const have=state.legendClues||[];
  return LEGEND_CLUE_KINDS.filter(k=>have.indexOf(a+':'+k)>=0).length;
}
function grantLegendClue(a,kind,msg){
  state.legendClues=state.legendClues||[];
  const key=a+':'+kind;
  if(state.legendClues.indexOf(key)>=0)return;
  state.legendClues.push(key);
  toast(msg,3200);
  if(legendClueCount(a)===LEGEND_CLUE_KINDS.length){
    setTimeout(()=>toast('🌙 Du spürst deutlich: hier ist etwas Besonderes ganz in der Nähe...',3400),1200);
  }
  saveGame(true);
}
function legendFor(a){
  const d=LEGEND_DATA[a],mp=MAPS[a];
  if(!d||!mp||!mp.legend)return null;
  return{key:'legend-'+a,pos:mp.legend,id:d.id,title:d.title,intro:d.intro,
    lvl:AREA_DEFS[a].cap+3};
}
// ============================ NEBENQUESTS ============================
// Manche Entwicklungen und ein neues Kryptid sind nur so zu bekommen.
const QUESTS=[
  {id:'q0',area:0,npcIdx:1,name:'Mut zum Fangen',
   offer:'Ehrlich gesagt... ich hab mich nie getraut, ein eigenes Blattli zu fangen. Zeig mir doch mal, dass das gar nicht so schwer ist – fang einfach eins für dich, dann glaub ich dir aufs Wort.',
   remind:'Hast du dich schon mit deinem eigenen Blattli verbündet? Zeig es mir, wenn es so weit ist!',
   check:()=>state.caught.some(id=>FAMILY_OF[id]==='blattli'),
   progress:()=>state.caught.some(id=>FAMILY_OF[id]==='blattli')?'Blattli verbündet ✓':'Noch kein Blattli verbündet',
   complete:'Du hast wirklich eins gebunden – und behältst es natürlich, es ist ja deins! Aber jetzt weiß ich, dass es geht. Hier, das hat meine Oma mir gegeben. Sie sagte, es sei für "etwas Besonderes". Vielleicht weißt du, wofür.',
   reward:{money:150,item:'wurzelkristall'}},
  {id:'q1',area:1,npcIdx:2,name:'Die verlorenen Seiten',
   offer:'Ich suche seit Jahren nach den fehlenden Seiten eines uralten Buches. Man munkelt, die Wächter des Waldes bewachen sie – seine Trainer stellen jeden auf die Probe, der sich nähert.',
   remind:'Hast du dich schon allen Herausforderern des Flüsterwalds gestellt?',
   check:()=>[0,1,2,3,4].every(s=>isDone('1-'+s)),
   progress:()=>[0,1,2,3,4].filter(s=>isDone('1-'+s)).length+'/5 Trainer im Flüsterwald besiegt',
   guardianWait:'Fünf Herausforderer bezwungen, gut. Aber irgendwo im tiefsten Wald wartet noch eine letzte Prüfung – der Wald selbst wird dich prüfen, bevor er sein Geheimnis preisgibt.',
   complete:'Der Wald hat dich angenommen. Nimm das – du hast es dir wirklich verdient.',
   legendGate:true,
   reward:{money:200,item:'seelenanker'}},
  {id:'q2',area:2,npcIdx:3,name:'Das Wesen im Riff',
   offer:'Ich erzähl jedem vom Riesenwesen im Riff – aber glauben tut mir keiner. Fang wenigstens ein Krabbo und zeig es mir, dann glaub ich dir, dass du klein anfängst wie ich einst.',
   remind:'Schon mit einem Krabbo verbündet? Die Scheren erkennt man sofort.',
   check:()=>state.caught.some(id=>FAMILY_OF[id]==='krabbo'),
   progress:()=>state.caught.some(id=>FAMILY_OF[id]==='krabbo')?'Krabbo verbündet ✓':'Noch kein Krabbo verbündet',
   complete:'Haha, da ist es ja! Behalt es gut, so ein Fang ist was Besonderes. Nimm das als Dank, du Glückspilz.',
   reward:{money:250,item:'schutzstein'}},
  {id:'q3',area:3,npcIdx:2,name:'Wettlauf gegen den Sturm',
   offer:'Nur die Schnellsten bestehen die Steppenhalle. Beweis es, und ich hab noch etwas für dich.',
   remind:'Schon durch die Steppenhalle durch?',
   check:()=>arenaCleared(3),
   progress:()=>arenaCleared(3)?'Steppenhalle bezwungen ✓':'Steppenhalle noch offen',
   guardianWait:'Die Halle geschafft – stark. Aber draußen in der Steppe zieht ein Sturm auf, den nicht jeder übersteht. Der wartet noch auf dich.',
   complete:'Der Sturm hat sich gelegt. Nimm das, du hast ihn wirklich bestanden.',
   legendGate:true,
   reward:{money:400,item:'fokusgurt'}},
  {id:'q4',area:4,npcIdx:0,name:'Erz für die Esse',
   offer:'Für ein neues Schutzschild brauch ich zwei Schutzsteine. Hast du welche über? Ich zahl\'s dir mit Zins zurück.',
   remind:'Zwei Schutzsteine, weißt du noch? Ich brauch sie wirklich.',
   check:()=>(state.bag.schutzstein||0)>=2,
   progress:()=>Math.min(2,state.bag.schutzstein||0)+'/2 Schutzsteine im Beutel',
   onComplete:()=>{state.bag.schutzstein-=2;if(state.bag.schutzstein<=0)delete state.bag.schutzstein;},
   complete:'Genau richtig! Hier, dafür kriegst du was Eigenes aus meiner Schmiede.',
   reward:{money:350,item:'ueberreste'}},
  {id:'q5',area:5,npcIdx:3,name:'Das Echo im Nebel',
   offer:'Du spürst es auch, oder? Dieses Ziehen im Nebel. Ich hab mein Leben damit verbracht, den Hinweisen nachzugehen. Vielleicht schaffst du, was mir nie gelungen ist.',
   remind:'Hast du schon alle drei Zeichen gefunden? Gerücht, Spur, Licht – erst dann zeigt es sich wirklich.',
   check:()=>legendClueCount(5)>=LEGEND_CLUE_KINDS.length,
   progress:()=>{
     const have=state.legendClues||[];
     const mark=k=>have.indexOf('5:'+k)>=0?'✓':'✗';
     return legendClueCount(5)+'/3 · Gerücht '+mark('geruecht')+' · Spur '+mark('spuren')+' · Licht '+mark('licht');
   },
   guardianWait:'Alle drei Zeichen gefunden... dann ist es fast so weit. Aber irgendetwas im Nebel wird dich zuerst prüfen wollen.',
   complete:'Du hast es geschafft... Als das Licht verschwand, blieb etwas zurück. Ich glaube, es gehört jetzt zu dir.',
   legendGate:true,
   reward:{money:100,mon:'nebelwisp'}},
  {id:'q6',area:6,npcIdx:1,name:'Kind des Schneefalls',
   offer:'Frosti zeigt sich nur bei Schneefall, heißt es. Wenn du eins fängst, glaub ich das Gerücht vielleicht auch mal.',
   remind:'Schon mit einem Frosti verbündet?',
   check:()=>state.caught.some(id=>FAMILY_OF[id]==='frosti'),
   progress:()=>state.caught.some(id=>FAMILY_OF[id]==='frosti')?'Frosti verbündet ✓':'Noch kein Frosti verbündet',
   complete:'Tatsächlich! Nimm das, du hast es dir verdient.',
   reward:{money:300,item:'heilkraut'}},
  {id:'q7',area:7,npcIdx:1,name:'Der erste Eintrag',
   offer:'Ich schreibe auf, wer die Liga bezwingt. Bisher... niemand. Werd der Erste, der es auf meine Liste schafft.',
   remind:'Noch nicht alle vier Meister vor Champion Vera bezwungen? Ich warte gespannt.',
   check:()=>AREAS[7].trainers.slice(0,4).every(t=>isDone(t.key)),
   progress:()=>AREAS[7].trainers.slice(0,4).filter(t=>isDone(t.key)).length+'/4 Liga-Meister besiegt',
   guardianWait:'Vier Meister bezwungen – bemerkenswert. Aber ganz oben, jenseits der Halle, wartet noch etwas, das älter ist als die Liga selbst.',
   complete:'Unglaublich... ich trag dich als Ersten ein. Nimm das – mehr hab ich nicht, aber es kommt von Herzen.',
   legendGate:true,
   reward:{money:500,item:'ahnenstein',itemN:3}},
  {id:'q8',area:0,giverName:'Forscher Elias',location:'Kleine Höhle (Mooshain)',
   offer:'Ich hab hier unten Skizzen von Wesen gemacht, die eigentlich gar nicht hier leben sollten. Keiner glaubt mir. Bring mir einen Beweis, ja?',
   remind:'Ein Brockel oder ein Erzling, irgendeins reicht mir als Beweis!',
   check:()=>state.caught.some(id=>FAMILY_OF[id]==='brockel'||FAMILY_OF[id]==='erzling'),
   progress:()=>state.caught.some(id=>FAMILY_OF[id]==='brockel'||FAMILY_OF[id]==='erzling')?'Beweis gefunden ✓':'Noch keinen Beweis gefunden',
   complete:'Ich wusste es! Hier unten gibt es mehr, als irgendwer ahnt. Nimm das als Dank – und erzähl niemandem, wo du es herhast.',
   reward:{money:220,item:'machtband'}},
  {id:'q9',area:0,npcIdx:0,name:'Ruf des Rudels',
   offer:'Nachts hör ich manchmal Heulen, weiter draußen auf der Wiese. Ein Wildhund, sagen die einen. Was ganz anderes, sagen die anderen. Schau doch mal nach, ja?',
   remind:'Hast du schon rausgefunden, was da draußen heult?',
   check:()=>state.caught.some(id=>FAMILY_OF[id]==='grimling'),
   progress:()=>state.caught.some(id=>FAMILY_OF[id]==='grimling')?'Rudeltier gefunden ✓':'Noch kein Rudeltier gefunden',
   complete:'Also doch! Ich hab es mir gedacht. Nimm das hier, als Dank fürs Nachschauen – und pass auf dich auf da draußen.',
   reward:{money:180,item:'schutzstein'}},
  {id:'q10',area:1,npcIdx:1,name:'Der Schatten im Unterholz',
   offer:'Manchmal seh ich aus dem Augenwinkel etwas Rotes zwischen den Bäumen huschen. Nie von vorne, immer nur den Schweif. Glaubst du mir, dass da wirklich was ist?',
   remind:'Hast du das rote Etwas zwischen den Bäumen schon zu fassen bekommen?',
   check:()=>state.caught.some(id=>FAMILY_OF[id]==='rotfell'),
   progress:()=>state.caught.some(id=>FAMILY_OF[id]==='rotfell')?'Den Schatten gefunden ✓':'Den Schatten noch nicht gefunden',
   complete:'Ich wusste doch, dass ich mir das nicht eingebildet habe! Hier, nimm das – für deine Mühe und meinen Seelenfrieden.',
   reward:{money:200,item:'heilkraut'}}
];
function grantQuestReward(q){
  const r=q.reward||{};
  let bits=[];
  if(r.money){state.money+=r.money;bits.push('💰 '+r.money+' Münzen');}
  if(r.item){addItem(r.item,r.itemN||1);bits.push('🎁 '+ITEMS[r.item].name+((r.itemN||1)>1?' ×'+r.itemN:''));}
  if(r.mon){
    const mon=makeMonster(r.mon,Math.max(5,AREA_DEFS[q.area].cap-5),false);
    markSeen(mon.id);markCaught(mon.id);
    if(state.team.length<6)state.team.push(mon);else state.box.push(mon);
    bits.push('✨ <b>'+DEX[r.mon].name+'</b> schließt sich dir an');
  }
  if(q.onComplete)q.onComplete();
  if(bits.length)toast('Belohnung: '+bits.join(' · '),3600);
  saveGame(true);
}
// ============================ NEBENBEREICHE ============================
// Kleine, unregelmaessig geformte Orte, die abseits der Hauptroute liegen.
// C=Versteckter Zugang (auf der Route) -> fuehrt in einen Nebenbereich
const SIDE_LINK={
  '0:1:6':'mooshain_steinkreis',
  '0:5:12':'mooshain_hoehle',
  '0:20:9':'bindungswiese',
  '1:1:9':'fluesterwald_schreiberei',
  '2:1:15':'kristallkueste_wrack',
  '6:20:13':'felsenpass_aussicht',
  '3:20:15':'donnersteppe_windmuehle',
  '4:1:2':'aschekrater_schmiede',
  '5:1:9':'nebelmoor_ruinen',
  '7:20:2':'meisterstadt_archiv',
  '7:5:9':'pfad_der_krone'
};
const SIDE_AREAS={
  bindungswiese:{
    name:'Bindungswiese',parentArea:0,parentLoc:'protown',returnPos:[20,9],
    spawn:[10,10],
    rows:['TTTTTTTTTTTTTTTTTTTTTT','T....................T','T...,,....,,....,,...T','T...,,....,,....,,...T','T....................T','T....................T','T....................T','T....................T','T....................T','T....................T','T.........DD.........T','TTTTTTTTTTTTTTTTTTTTTT'],
    npcs:[
      {n:'Flamko',key:'bond-flamko',pos:[4,2],bondStarter:'flamko',
       t:['Ein Flamko schaut neugierig aus dem hohen Gras. Seine Augen folgen jeder deiner Bewegungen.']},
      {n:'Aquappi',key:'bond-aquappi',pos:[10,2],bondStarter:'aquappi',
       t:['Ein Aquappi platscht leise im Tau. Es hält kurz inne und mustert dich aufmerksam.']},
      {n:'Blattli',key:'bond-blattli',pos:[16,2],bondStarter:'blattli',
       t:['Ein Blattli wiegt sich im Wind, halb verborgen zwischen den Halmen. Es scheint zu warten.']}
    ]
  },
  mooshain_steinkreis:{
    name:'Alter Steinkreis',parentArea:0,returnPos:[1,6],
    rows:['TTTTTTTTTTTTTTTTTTTTTT','TTTTTTTTTTTTTTTTTTTTTT','TTTTTTTTTTTTTTTTTTTTTT','TTTTTTTT.T.....TTTTTTT','TTTTTT...........TTTTT','TTTTT...O...O.....TTTT','TTTT...........O..TTTT','TTTT...............TTT','TTTT..O..M...M.....TTT','TTTT............O...TT','TTTT..O.M.....M....TTT','TTTT......M.M......TTT','TTTT...........O..TTTT','TTTTTT..O...O....TTTTT','TTTTTT..........TTTTTT','TTTTTTTT.T.....TTTTTTT','TTTTTTTTTTTDTTTTTTTTTT','TTTTTTTTTTTTTTTTTTTTTT'],
    spawn:[11, 15],ambient:['fog','fireflies'],
    npcs:[{n:'Uralter Stein',kind:'stone',pos:[11, 9],
      t:['Der Stein ist mit Runen bedeckt, die kein heutiges Alphabet kennt.',
         'Zwischen den Zeichen erkennst du schwach die Umrisse vertrauter Kryptiden – und einiger, die dir völlig fremd sind.',
         '"...als der Nebel sie nahm, kehrte keines zurueck..." Mehr laesst sich nicht entziffern.']}]
  },
  mooshain_hoehle:{
    name:'Kleine Höhle',parentArea:0,returnPos:[5,14],cave:true,
    rows:['BBBBBBBBBBBBBBBBBBBBBB','BBBBBBBBBBBBBBBBBBBBBB','BBBBBBBBBBBBBBBBBBBBBB','BBBBBBBBBBBBBBBBBBBBBB','BBBBBBBBBFFFFFFFBBBBBB','BBBBBBBBBFFFFFFFBBBBBB','BBBBBBBBBFFFOFFFBBBBBB','BBBBBBBFFFFFFOFFBBBBBB','BBBBFFFFFFFFFFFFFFBBBB','BBBBFFFFFFFBBBFFFFBBBB','BBBBFFOFBBBBBBFFFFFFBB','BBBBFFFFBBBBBBFFFOFFBB','BBBBFFFFBBBBBBFFFFFFBB','BBBBFFFFFFBBBBBFFFFFBB','BBBBFOFFFFFFFBBBBBBBBB','BBBBFFFFFFFFFBBBBBBBBB','BBBBBBBBBFDFFBBBBBBBBB','BBBBBBBBBBBBBBBBBBBBBB'],
    spawn:[10, 15],ambient:[],
    roster:['brockel','erzling'],
    pickups:[{pos:[18, 11],item:'heilkraut',qty:1,
      msg:'✨ Tief in der Höhle findest du ein wucherndes <b>Heilkraut</b> – hier drinnen bekommt es nie Sonnenlicht und ist trotzdem kerngesund.'}],
    npcs:[{n:'Forscher Elias',pos:[12,5],quest:'q8',
      t:['Endlich Gesellschaft! Hier unten verirrt sich sonst kaum wer her.',
         'Ich kartiere diese Höhle schon seit Wochen. Die Wände hier erzählen mehr, als man denkt.']}]
  },
  fluesterwald_schreiberei:{
    name:'Verlassene Schreiberei',parentArea:1,returnPos:[1,9],
    rows:['TTTTTTTTTTTTTTTTTTTTTT','TTTTTTTTTTTTTTTTTTTTTT','TTTTTTTTTTTTTTTTTTTTTT','TTTTT.......TTTTTTTTTT','TTTTT.O..O..TTTTTTTTTT','TTTTT.............TTTT','TTTTT...O.O.......TTTT','TTTTT..........OO.TTTT','TTTTTTTTTT........TTTT','TTTTTTT.....O...O.TTTT','TTTTTTT..O..O.....TTTT','TTTTTTTO..........TTTT','TTTTTTT.......TTTTTTTT','TTTTTTT......O.TTTTTTT','TTTTTTT........TTTTTTT','TTTTTTTT.......TTTTTTT','TTTTTTTT...D...TTTTTTT','TTTTTTTTTTTTTTTTTTTTTT'],
    spawn:[11, 15],ambient:['fog','fireflies'],
    npcs:[
      {n:'Vermoderte Regale',kind:'shelf',pos:[9, 12],
        t:['Die meisten Bände sind längst zu Staub zerfallen. Ein einzelner Satz ist noch lesbar: <br><i>"...und dann, innerhalb einer einzigen Jahreszeit, waren sie einfach fort."</i>']},
      {n:'Eingestürztes Regal',kind:'shelf',pos:[14, 8],
        t:['Zwischen den Trümmern liegt eine zerfledderte Karte. Mehrere Orte sind mit dem gleichen Zeichen markiert – einem Auge in einem Kreis.',
           'Wer auch immer diese Karte gezeichnet hat, war überzeugt, dass die Vorfälle zusammenhängen.']},
      {n:'Verkohltes Regal',kind:'shelf',pos:[7, 5],
        t:['Dieser Teil des Archivs ist verbrannt. Nur ein Wort lässt sich zwischen der Asche noch erahnen: <br><i>"Himmelskrone."</i>']}
    ],
    pickups:[{pos:[15, 9],item:'r_pflanze',qty:1,
      msg:'✨ Unter einem eingestürzten Regal liegt eine fast unversehrte <b>Schriftrolle</b>!'}]
  },
  kristallkueste_wrack:{
    name:'Gestrandetes Wrack',parentArea:2,returnPos:[10,7],
    rows:['TTTTTTTTTTTTTTTTTTTTTT','TWWWWWWWWWWWWWWWWWWWWT','TWWWWWWWWWWWWWWWWWWWWT','TWWWWWWWWWWWWWWWWWWWWT','TWWWWWWWWWWWWWWWWWWWWT','TWWWWWWWWWWWWWWWWWWWWT','TWWWWWWWWWWWWWWWWWWWWT','TWWWW............WWWWT','TWWWW........O...WWWWT','TWWWW...OOOO..O..WWWWT','TWWWW...O..O.....WWWWT','TWWWW............WWWWT','TWWWW....OOO.....WWWWT','TWWWW............WWWWT','TWWWW............WWWWT','TWWWW............WWWWT','T.........D..........T','TTTTTTTTTTTTTTTTTTTTTT'],
    spawn:[10, 15],ambient:['rain'],
    pickups:[{pos:[10, 10],item:'ueberreste',qty:2,money:180,requireType:'Wasser',
      msg:'✨ Mit vereinten Kräften drückt ihr die verrostete Ladeluke auf – im Frachtraum liegen noch immer Vorräte!',
      lockedMsg:'🔒 Die Ladeluke ist zugerostet und stemmt sich keinen Millimeter. Vielleicht hilft ein Wasser-Kryptid in deinem Team, sie von innen zu lösen.'}]
  },
  felsenpass_aussicht:{
    name:'Aussichtspunkt',parentArea:6,returnPos:[20,13],
    rows:['TTTTTTTTTTTTTTTTTTTTTT','TTTTTTTTTTTTTTTTTTTTTT','TTTTTTTTT.....TTTTTTTT','TTTTTTTTT.....TTTTTTTT','TTTTTTTTT...OTTTTTTTTT','TTTTTTTTT.OTTTTTTTTTTT','TTTTTTTTT.TTTTTTTTTTTT','TTTTTTTTO....TTTTTTTTT','TTTTTTTTTTTT.OTTTTTTTT','TTTTTTTTTTOT.TTTTTTTTT','TTTTTTTTT....TTTTTTTTT','TTTTTTTTO.TTTTTTTTTTTT','TTTTTTTTT.TTOTTTTTTTTT','TTTTTTTTT...TTTTTTTTTT','TTTTTTTTTTT.TTTTTTTTTT','TTTTTTTTTTT.TTTTTTTTTT','TTTTTTTTTTTDTTTTTTTTTT','TTTTTTTTTTTTTTTTTTTTTT'],
    spawn:[11, 15],ambient:['snow'],
    pickups:[{pos:[11, 3],
      msg:'🏔️ Von hier oben überblickst du das ganze Tal. Im Westen liegt Felsenwacht, dahinter erahnst du sogar die Türme der Meisterstadt. Für einen Moment bleibst du einfach stehen.'}]
  },
  donnersteppe_windmuehle:{
    name:'Windmühlenruine',parentArea:3,returnPos:[20,15],
    rows:['TTTTTTTTTTTTTTTTTTTTTT','TTTTTTTTTTTTTTTTTTTTTT','TTTT.........TTTTTTTTT','TTTT.........TTTTTTTTT','TTTT.........TTTTTTTTT','TTTTTTTTTT...TTTTTTTTT','TTTTTTTTTT........TTTT','TTTTTTTTTT.O......TTTT','TTTTTTTTTT......O.TTTT','TTTTTTTTTT........TTTT','TTTTTTTTTTTTTTT...TTTT','TTTTTTTTTTTTTTT...TTTT','TTTTTTTTTTTTTTT...TTTT','TTTTTTTTT.......O.TTTT','TTTTTTTTT.....O...TTTT','TTTTTTTTT.........TTTT','TTTTTTTTT..D......TTTT','TTTTTTTTTTTTTTTTTTTTTT'],
    spawn:[11, 15],ambient:['dust'],
    npcs:[
      {n:'Sternenwart Elou',pos:[16, 10],
        t:['Ah, Besuch. Hier oben kommt selten wer hoch. Ich hab mein halbes Leben mit dem Blick nach oben verbracht.',
           'Siehst du die alten Linsen? Nicht für Wolken gebaut. Für etwas, das nur alle paar Generationen erscheint.']},
      {n:'Alte Sternkarten',kind:'shelf',pos:[5, 3],
        t:['Vergilbte Sternkarten bedecken die Wand. Eine Route ist mit roter Tinte nachgezeichnet – ein Lichtpunkt, der sich über Wochen bewegte, bis er stehenblieb.',
           'Am Rand eine Notiz: <br><i>"Eine Krone aus Licht, dort wo der Nebel am dichtesten steht."</i>']},
      {n:'Wetterjournal',kind:'shelf',pos:[8, 3],
        t:['Ein Wetterjournal. Die letzten Einträge sind hastig, die Schrift zittrig: <br><i>"Der Sturm kam mit dem Licht, nicht davor. Und danach... Stille, wo vorher Rufe waren."</i>']}
    ],
    pickups:[{pos:[6, 3],item:'kronensplitter',qty:1,
      msg:'✨ Zwischen den Linsen liegt ein warmer, leicht schimmernder Splitter – ein <b>Kronensplitter</b>.'}]
  },
  aschekrater_schmiede:{
    name:'Verlassene Schmiede',parentArea:4,returnPos:[1,2],
    rows:['TTTTTTTTTTTTTTTTTTTTTT','TTTTTTTTTTTTTTTTTTTTTT','TTTTTTTTTTTTTTTTTTTTTT','TLLLLLLLLLLLLLLLLTTTTT','TLLLLLLLLLLLLLLLLTTTTT','TLLLLLLLLLLLLLLLLTTTTT','TLLLLLLLLLLLLLLLLTTTTT','TLLLL............TTTTT','TTTTT....O...O...TTTTT','TTTTT............TTTTT','TLLLL............LLLLT','TLLLL....O...O...LLLLT','TLLLL............LLLLT','TLLLL............LLLLT','TLLLL............LLLLT','TTTTTTTTTTTTTTTTTTTTTT','TTTTTTTTTTTDTTTTTTTTTT','TTTTTTTTTTTTTTTTTTTTTT'],
    spawn:[11, 15],ambient:['ash'],
    npcs:[
      {n:'Werkbank',kind:'shelf',pos:[7, 9],
        t:['Werkzeug, halb im Ruß begraben. Auf der Werkbank liegt eine unfertige Zeichnung – vier ineinandergreifende Splitter, die zusammen etwas Größeres ergeben sollen.']},
      {n:'Verkohlter Brief',kind:'shelf',pos:[14, 9],
        t:['Ein Brief, nie abgeschickt: <br><i>"Wenn wir den Schlüssel nicht rechtzeitig fertigstellen, wird es niemanden mehr geben, der die Krone aufhält, wenn sie zurückkehrt."</i>',
           'Der Rest ist verkohlt und nicht mehr lesbar.']}
    ],
    pickups:[{pos:[11, 9],item:'kronensplitter',qty:1,requireType:'Feuer',
      msg:'✨ Die Glut der alten Esse flammt kurz auf und gibt einen zweiten <b>Kronensplitter</b> frei, der tief im erkalteten Metall steckte.',
      lockedMsg:'🔒 Der alte Amboss ist erkaltet und verklebt mit erstarrter Schlacke. Vielleicht bringt ein Feuer-Kryptid die Esse noch einmal zum Glühen.'}]
  },
  nebelmoor_ruinen:{
    name:'Versunkene Ruinen',parentArea:5,returnPos:[1,9],
    rows:['TTTTTTTTTTTTTTTTTTTTTT','T....................T','T....................T','T....................T','T......O......O......T','T....................T','T....................T','T....................T','T........O..O........T','T....................T','T....................T','T....................T','T....................T','T......O......O......T','T....................T','T....................T','T..........D.........T','TTTTTTTTTTTTTTTTTTTTTT'],
    spawn:[11, 15],ambient:['fog','irrlichter'],
    npcs:[
      {n:'Verwitterter Altar',kind:'stone',pos:[11, 8],
        t:['In den Stein ist ein Auge in einem Kreis eingelassen – dasselbe Zeichen wie auf der zerfledderten Karte im Flüsterwald.',
           'Um den Altar herum sind flache Vertiefungen, wie für vier Gegenstände, die längst nicht mehr da sind.',
           '<i>"...der Nebel nahm sie nicht. Der Nebel verbarg sie – vor etwas, das nach ihnen suchte."</i>']}
    ],
    pickups:[{pos:[11, 8],item:'kronensplitter',qty:1,
      msg:'✨ In einer der leeren Vertiefungen am Altar liegt, halb im Moorwasser versunken, ein dritter <b>Kronensplitter</b>.'}]
  },
  meisterstadt_archiv:{
    name:'Archiv der Ahnen',parentArea:7,returnPos:[20,2],
    rows:['TTTTTTTTTTTTTTTTTTTTTT','TTTTTTTTTTTTTTTTTTTTTT','TTTTTTTTTTTTTTTTTTTTTT','TTTT.......O.......TTT','TTTT.....O...O.....TTT','TTTT...............TTT','TTTT...............TTT','TTTTTTTTT.....TTTTTTTT','TTTTTT...........TTTTT','TTTTTCO.......O.TTTTT','TTTTTT...........TTTTT','TTTTTT...........TTTTT','TTTTTT...........TTTTT','TTTTTT...........TTTTT','TTTTTTTT.......TTTTTTT','TTTTTTTT.......TTTTTTT','TTTTTTTT...D...TTTTTTT','TTTTTTTTTTTTTTTTTTTTTT'],
    spawn:[11, 15],ambient:[],
    npcs:[
      {n:'Archivarin Wesa',pos:[9, 9],
        t:['Die Liga wurde nicht nur gegründet, um die Stärksten zu krönen, weißt du. Das ist nur die Geschichte, die man den Besuchern erzählt.',
           'Die ersten Meister waren Wächter. Sie hielten Wacht für den Fall, dass die Krone zurückkehrt – und bereiteten jene vor, die stark genug sein könnten, ihr zu begegnen.']},
      {n:'Liga-Protokolle',kind:'shelf',pos:[6, 4],
        t:['Alte Liga-Protokolle. Ein Absatz ist mehrfach unterstrichen: <br><i>"Sollten alle vier Splitter je wieder zusammenfinden, ist es an der Zeit."</i>']},
      {n:'Namensliste',kind:'shelf',pos:[16, 4],
        t:['Eine Liste von Namen, alle mit demselben Vermerk versehen: <i>"...bestand die Prüfung, wurde Wächter, wartet."</i> Der letzte Eintrag ist über 200 Jahre alt.']}
    ],
    pickups:[{pos:[11, 5],item:'kronensplitter',qty:1,
      msg:()=>((state.bag.kronensplitter||0)>=4?
        '✨ In einer verschlossenen Vitrine liegt der letzte <b>Kronensplitter</b>. Sobald du ihn berührst, fügen sich alle vier zu einem warmen, leise summenden Ganzen zusammen. Irgendwo, tief in dir, ist dir klar: Das hier war noch nicht das Ende der Geschichte.'
        :'✨ In einer verschlossenen Vitrine liegt der letzte <b>Kronensplitter</b> – mit den anderen zusammen fühlt er sich plötzlich viel schwerer an, als er aussieht.')}]
  },
  pfad_der_krone:{
    name:'Der Pfad der Krone',parentArea:7,returnPos:[5,9],
    unlockCheck:()=>state.champion&&(state.bag.kronensplitter||0)>=4,
    lockedMsg:'🔒 Die Tür bleibt reglos. Es fühlt sich an, als würde noch etwas fehlen – vielleicht bist du noch nicht bereit, oder etwas ist noch nicht vollständig.',
    rows:['TTTTTTTTTTTTTTTTTTTTTT','TTTTTTTTTTTTTTTTTTTTTT','TTTTTT.........TTTTTTT','TTTTTT.........TTTTTTT','TTTTTT.........TTTTTTT','TTTTTT.........TTTTTTT','TTTTTTTT........TTTTTT','TTTTTTTT.........TTTTT','TTTTTTTTT........TTTTT','TTTTTT...........TTTTT','TTTTT............TTTTT','TTTTT...........TTTTTT','TTTTT.......TTTTTTTTTT','TTTTT........TTTTTTTTT','TTTTTT.......TTTTTTTTT','TTTTTTTTTT...TTTTTTTTT','TTTTTTTTTT.D.TTTTTTTTT','TTTTTTTTTTTTTTTTTTTTTT'],
    spawn:[11, 15],ambient:['rays','fireflies','fog'],
    npcs:[{n:'Hera',pos:[10, 3],key:'hera',
      battleTeam:[
        {id:'abbild_silvarion',lvl:58},{id:'abbild_voltrex',lvl:58},
        {id:'abbild_umbrakor',lvl:58},{id:'abbild_aeternis',lvl:59},{id:'valenor',lvl:60}
      ],
      battleIntro:'Hera lächelt müde. "So lange schon niemand mehr hier hoch. Du trägst alle vier Splitter – dann weißt du, worum es hier geht. Zeig mir, ob du bereit bist."',
      battleWin:'Hera: "...Ja. Genau so." ',
      t:['Ich bin schon lange hier. Länger, als ich selbst noch genau weiß.',
         'Die vier, die du gerade gegen mich gesehen hast, waren nie ganz echt – nur das, was von ihnen übrig bleibt, wenn man denselben Moment zu oft miterlebt.',
         'Valenor dagegen ist echt. Er ist mit mir hier geblieben, damals, und all die Jahre über. Jetzt gehört er zu dir.',
         'Die meisten, die diesen Pfad gehen, kehren irgendwann zurück, verändert, in Frieden. Ich habe mich einfach entschieden zu bleiben – jemand musste ja aufpassen.',
         'Geh nur. Du weißt jetzt, wie man den Weg findet. Das reicht.']}
    ]
  }
};

const RIVAL_LINES=[
  ['Rivale Kai: "Da bist du ja! Mein Team ist längst weiter als deins."',
   'Rivale Kai: "Anfängerglück. Mehr war das nicht."'],
  ['Rivale Kai: "Schon wieder du? Diesmal habe ich trainiert."',
   'Rivale Kai: "Wie machst du das nur... egal, ich hole auf!"'],
  ['Rivale Kai: "Der Wald hat mich gelehrt. Dich auch?"',
   'Rivale Kai: "Knapp. Sehr knapp. Beim nächsten Mal nicht."'],
  ['Rivale Kai: "Ich habe deine Kämpfe beobachtet. Ich kenne deine Tricks."',
   'Rivale Kai: "Du kämpfst anders als erwartet. Respekt."'],
  ['Rivale Kai: "Keine Sprüche mehr. Nur noch Kampf."',
   'Rivale Kai: "...Du bist wirklich gut geworden."'],
  ['Rivale Kai: "Wir sind beide weit gekommen. Aber nur einer geht weiter."',
   'Rivale Kai: "Dann bist wohl du derjenige."'],
  ['Rivale Kai: "Letzte Chance vor der Liga. Ich gebe alles!"',
   'Rivale Kai: "Geh und werde Champion. Ich hole dich dort ein."'],
  ['Rivale Kai: "Bis hierher also. Zeig mir, was in dir steckt!"',
   'Rivale Kai: "Du hattest es immer in dir. Viel Glück."']
];
function rivalFor(a){
  const mp=MAPS[a];if(!mp.rival)return null;
  const d=AREA_DEFS[a],cap=d.cap;
  const counter={flamko:'aquappi',aquappi:'blattli',blattli:'flamko'};
  const rid=counter[state.starter||'flamko']||'aquappi';
  const extra=a>=4?2:1;
  const team=[{id:speciesForLevel(rid,cap),lvl:cap}];
  for(let k=0;k<2+extra;k++){
    const b=d.roster[k%d.roster.length],L=cap-(k<2?1:2);
    team.push({id:speciesForLevel(b,Math.max(2,L)),lvl:Math.max(2,L)});
  }
  return{key:'rival-'+a,pos:mp.rival,name:'Rivale Kai',kind:'rival',smart:true,dbl:(a===3||a===6),team,pal:RIVAL_PAL,lvl:cap,
    intro:RIVAL_LINES[Math.min(RIVAL_LINES.length-1,a)][0],
    win:RIVAL_LINES[Math.min(RIVAL_LINES.length-1,a)][1]};
}
// ============================ ZWEITER RIVALE: FABIAN ============================
const FABIAN_PAL={B:'#3c7a5e',F:'#e3b184',K:'#20221c',R:'#5c6e8a',J:'#2a3428'};
const FABIAN_POS={0:[3,8],1:[13,5],2:[8,12],3:[4,10],4:[16,9],5:[14,4],6:[9,9]};
const FABIAN_LINES=[
  ['Fabian: "Oh – hallo. Ich beobachte hier nur, wie sich Nesselqualle mit ihrer Umgebung abstimmt. Magst du kurz mitmachen?"',
   'Fabian: "Interessant. Dein Kryptid reagiert ganz anders auf Druck als meins. Danke, das hilft mir weiter."'],
  ['Fabian: "Wir sehen uns wieder. Ich hab in der Zwischenzeit viel gelernt – nicht nur über Kampf."',
   'Fabian: "Du gewinnst nicht, weil du stärker bist. Du verstehst dein Kryptid einfach besser. Bemerkenswert."'],
  ['Fabian: "Manche jagen Sieg um Sieg. Ich will nur wissen, wie weit eine Bindung tragen kann. Zeig es mir?"',
   'Fabian: "Selbst verloren lerne ich mehr als bei jedem Sieg. Ehrlich gesagt bevorzuge ich das so."'],
  ['Fabian: "Ich hab gehört, du kommst gut voran. Kein Wunder, bei der Verbindung zu deinem Team."',
   'Fabian: "Es gibt Stärke, die man nicht trainieren kann. Die hast du wohl einfach."'],
  ['Fabian: "Ehrlich? Ich bin nicht hier, um zu gewinnen. Ich will nur sehen, wie ihr beide zusammen wirkt."',
   'Fabian: "Genau das meinte ich. Nicht Kraft – Vertrauen. Danke für den Kampf."'],
  ['Fabian: "Die Liga rückt näher. Ich bin nicht sicher, ob ich bereit bin – aber testen wir es."',
   'Fabian: "Du bist bereit für das, was kommt. Ich merk das an der Art, wie ihr kämpft."'],
  ['Fabian: "Letzte Station vor der Liga für uns beide. Egal, was passiert – es war eine gute Reise bis hierher."',
   'Fabian: "Geh und werde Champion. Und wenn du mal wieder vorbeikommst, erzähl mir, wie es deinem Team ergangen ist."']
];
function fabianFor(a){
  const pos=FABIAN_POS[a];if(!pos)return null;
  const d=AREA_DEFS[a],cap=d.cap;
  const sig=speciesForLevel('nesselqualle',cap);
  const team=[{id:sig,lvl:cap}];
  const extra=a>=4?2:1;
  for(let k=0;k<1+extra;k++){
    const pool=['grimling','schlingling','wuestling','rotfell','giftschlinge','dreiwart','wolkenross'];
    const b=pool[(a+k)%pool.length],L=cap-(k===0?1:2);
    team.push({id:speciesForLevel(b,Math.max(2,L)),lvl:Math.max(2,L)});
  }
  return{key:'fabian-'+a,pos,name:'Fabian',kind:'rival',smart:true,dbl:false,team,pal:FABIAN_PAL,lvl:cap,
    intro:FABIAN_LINES[Math.min(FABIAN_LINES.length-1,a)][0],
    win:FABIAN_LINES[Math.min(FABIAN_LINES.length-1,a)][1]};
}
// ============================ SPEICHERN ============================
const SAVE_KEY='tm5-save';
const hasStorage=(typeof window.storage!=='undefined')&&window.storage&&typeof window.storage.set==='function';
// Browser-Speicher: funktioniert, sobald das Spiel als echte Webseite läuft
const LS=(function(){try{const k='__tm5test';window.localStorage.setItem(k,'1');
  window.localStorage.removeItem(k);return window.localStorage;}catch(e){return null;}})();
let storageBroken=false;
function withTimeout(p,ms){return Promise.race([p,new Promise((_,rj)=>setTimeout(()=>rj(new Error('Timeout')),ms))]);}
function snapshot(){
  return{v:6,team:state.team,box:state.box,leadIdx:state.leadIdx,bag:state.bag,money:state.money,
    seen:state.seen,caught:state.caught,defeated:state.defeated,rivals:state.rivals,
    legends:state.legends,found:state.found,scrolls:state.scrolls,npcGifts:state.npcGifts,
    events:state.events,npcSeen:state.npcSeen,legendClues:state.legendClues,quests:state.quests,sideId:state.sideId,legendCluePity:state.legendCluePity,citiesVisited:state.citiesVisited,
    area:state.area,loc:state.loc,
    px:state.px,py:state.py,champion:state.champion,starter:state.starter,dexRewards:state.dexRewards};
}
// Ältere Spielstände: Katalog aus vorhandenen Kryptiden ableiten
function repairCatalog(){
  state.team.concat(state.box).forEach(m=>{
    let cur=FAMILY_OF[m.id]||m.id;
    while(cur){
      if(state.seen.indexOf(cur)<0)state.seen.push(cur);
      if(cur===m.id)break;
      cur=DEX[cur].evo;
    }
    if(state.seen.indexOf(m.id)<0)state.seen.push(m.id);
    if(state.caught.indexOf(m.id)<0)state.caught.push(m.id);
  });
}
function fixMon(m){
  if(!m.moves||!m.moves.length)m.moves=movesForLevel(m.id,m.level);
  if(!m.ap||m.ap.length!==m.moves.length)m.ap=apFor(m.moves);
  const pct=m.maxHp?Math.max(0,Math.min(1,m.hp/m.maxHp)):1;
  refreshStats(m);
  m.hp=Math.max(1,Math.round(m.maxHp*pct));
  if(m.status===undefined)m.status=null;
  return m;
}
function applySave(s){
  state.team=(s.team||[]).map(fixMon);state.box=(s.box||[]).map(fixMon);
  state.leadIdx=s.leadIdx||0;state.bag=s.bag||{bindungsstein:5};state.money=s.money==null?600:s.money;
  state.seen=s.seen||[];state.caught=s.caught||[];state.defeated=s.defeated||[];state.rivals=s.rivals||[];
  state.legends=s.legends||[];state.found=s.found||[];state.scrolls=s.scrolls||[];
  state.npcGifts=s.npcGifts||[];state.loc=s.loc||'stadt';state._useItem=null;
  state.events=s.events||[];state.npcSeen=s.npcSeen||[];state.legendClues=s.legendClues||[];state.quests=s.quests||{};state.sideId=s.sideId||null;state.legendCluePity=s.legendCluePity||{};state.citiesVisited=s.citiesVisited||[];
  state.pendingLearn=[];state.pendingEvo=[];state._equip=null;
  state.area=s.area||0;state.px=s.px==null?10:s.px;state.py=s.py==null?16:s.py;
  state.champion=!!s.champion;state.starter=s.starter||'flamko';state.dexRewards=s.dexRewards||[];
  if(!state.team.length)state.team=[makeMonster('flamko',5)];
  if(state.leadIdx>=state.team.length)state.leadIdx=0;
  state._tab='team';state._detail=null;
  repairCatalog();
}
function saveStatus(m){if(state.mode==='team'){const e=$('saveStatus');if(e)e.innerHTML=m;}else toast(m);}
async function saveGame(silent){
  const json=JSON.stringify(snapshot());
  // 1) Artefakt-Speicher der App
  if(hasStorage&&!storageBroken){
    const tries=[()=>window.storage.set(SAVE_KEY,json,false),()=>window.storage.set(SAVE_KEY,json)];
    for(const fn of tries){
      try{const r=await withTimeout(fn(),3000);if(r){if(!silent)saveStatus('💾 Gespeichert! ✓');return true;}}catch(e){}
    }
    storageBroken=true;
  }
  // 2) Browser-Speicher (auf einer gehosteten Seite)
  if(LS){
    try{LS.setItem(SAVE_KEY,json);if(!silent)saveStatus('💾 Gespeichert! ✓ (Browser-Speicher)');return true;}catch(e){}
  }
  if(!silent)saveStatus('ℹ️ Automatisches Speichern ist hier nicht möglich.<br>Sichere über <b>📋 Code</b>.');
  return false;
}
async function loadGame(){
  if(hasStorage){
    for(const fn of [()=>window.storage.get(SAVE_KEY,false),()=>window.storage.get(SAVE_KEY)]){
      try{const r=await withTimeout(fn(),3000);if(r&&r.value)return JSON.parse(r.value);}catch(e){}
    }
  }
  if(LS){try{const v=LS.getItem(SAVE_KEY);if(v)return JSON.parse(v);}catch(e){}}
  return null;
}
function toCode(){try{return btoa(JSON.stringify(snapshot()));}catch(e){return '';}}
function fromCode(c){try{const s=JSON.parse(atob((c||'').trim()));if(!s||!s.team)return false;applySave(s);return true;}catch(e){return false;}}

// ============================ DEX-TRACKING ============================
function markSeen(id){if(state.seen.indexOf(id)<0)state.seen.push(id);}
function markCaught(id){
  if(state.caught.indexOf(id)<0)state.caught.push(id);
  markSeen(id);
  [[8,'bindungsstein',5,'5 Bindungssteine'],[16,'vertrauensstein',5,'5 Vertrauenssteine'],[24,'ahnenstein',5,'5 Ahnensteine']].forEach(r=>{
    if(state.caught.length>=r[0]&&state.dexRewards.indexOf(r[0])<0){
      state.dexRewards.push(r[0]);addItem(r[1],r[2]);
      setTimeout(()=>toast('📖 Katalog-Belohnung ('+r[0]+' Arten): '+r[3]+'!',3200),900);
    }
  });
}
function addItem(id,n){state.bag[id]=(state.bag[id]||0)+(n||1);}
function useItemCount(id){state.bag[id]=(state.bag[id]||0)-1;if(state.bag[id]<=0)delete state.bag[id];}

// ============================ TITEL ============================
// ============================ INTRO ============================
let introRaf=null,introSkipped=false;
function finishIntro(){
  if(introSkipped)return;
  introSkipped=true;
  if(introRaf)cancelAnimationFrame(introRaf);
  showScreen('title');
  initTitle().catch(e=>window.__showFatal&&window.__showFatal('Titel: '+(e&&e.message?e.message:e),false));
}
function startIntro(){
  const cv=$('introCanvas'),ctx=cv.getContext('2d');
  const W=352,H=352,AUTO_S=7;
  const t0=performance.now();
  const stars=Array.from({length:26},(_,i)=>({
    x:h2(i,201)*W,y:h2(i,202)*H*0.55,s:1+h2(i,203)*1.6,ph:h2(i,204)*Math.PI*2}));
  const hills=[{y:H*.62,amp:18,col:'#1c1330',speed:2},{y:H*.72,amp:24,col:'#150e26',speed:4},
    {y:H*.84,amp:30,col:'#0e091c',speed:7}];
  function draw(now){
    if(introSkipped)return;
    const t=(now-t0)/1000;
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#241638');g.addColorStop(.55,'#3a2a5c');g.addColorStop(1,'#6a4a7c');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    stars.forEach(s=>{
      const pulse=Math.sin(t*1.6+s.ph)*.5+.5;
      ctx.fillStyle='rgba(240,232,255,'+(.25+pulse*.55)+')';
      ctx.beginPath();ctx.arc(s.x,s.y,s.s,0,Math.PI*2);ctx.fill();
    });
    hills.forEach((h,hi)=>{
      ctx.fillStyle=h.col;
      ctx.beginPath();ctx.moveTo(0,H);
      const off=(t*h.speed)%40;
      for(let x=-40;x<=W+40;x+=20){
        const yy=h.y+Math.sin((x+off)*.02+hi)*h.amp*.3+Math.sin((x+off)*.008)*h.amp;
        ctx.lineTo(x,yy);
      }
      ctx.lineTo(W,H);ctx.closePath();ctx.fill();
    });
    for(let i=0;i<4;i++){
      const y=H*.58+i*14+Math.sin(t*.3+i)*6;
      const x=((h2(i,210)*W)+t*(8+i*3))%(W+180)-90;
      const grad=ctx.createRadialGradient(x,y,10,x,y,120);
      grad.addColorStop(0,'rgba(225,220,240,.18)');grad.addColorStop(1,'rgba(225,220,240,0)');
      ctx.fillStyle=grad;ctx.fillRect(x-120,y-60,240,120);
    }
    // Ein rätselhaftes Wesen huscht einmal als Silhouette über den Horizont
    if(t>1.6&&t<6.3){
      const walkT=(t-1.6)/4.7;
      const sx=-30+walkT*(W+60),sy=H*.7,bob=Math.sin(t*8)*2;
      ctx.save();
      ctx.globalAlpha=Math.min(1,Math.min(t-1.6,6.3-t)*1.5);
      ctx.filter='brightness(0)';
      paintMon(ctx,'silvarion',sx-10,sy-16+bob,1.7,walkT>0.5,false);
      ctx.restore();
    }
    if(t>=AUTO_S){finishIntro();return;}
    introRaf=requestAnimationFrame(draw);
  }
  introRaf=requestAnimationFrame(draw);
  cv.addEventListener('click',finishIntro);
  $('btnIntroSkip').addEventListener('click',e=>{e.stopPropagation();finishIntro();});
}
async function initTitle(){
  const row=$('starterRow');row.innerHTML='';
  const newGameBtn=document.createElement('button');
  newGameBtn.textContent='▶ Neues Spiel beginnen';
  newGameBtn.style.width='100%';
  newGameBtn.onclick=()=>{
    state.starter=null;state.team=[];state.box=[];state.leadIdx=0;
    state.bag={};state.money=0;state.seen=[];state.caught=[];
    state.defeated=[];state.rivals=[];state.legends=[];state.found=[];state.scrolls=[];state.npcGifts=[];
    state.pendingLearn=[];state.pendingEvo=[];state._equip=null;state.champion=false;state.dexRewards=[];
    state.citiesVisited=[];state.npcSeen=[];state.quests={};
    state.loc='protown';state.area=0;
    state.px=10;state.py=15;state.healed=false;
    saveGame(true);
    enterWorld();toast('Willkommen in '+PROLOGUE_TOWN.name+'! 🌿',3000);
  };
  row.appendChild(newGameBtn);
  if(!hasStorage&&!LS){
    $('storageNote').innerHTML='ℹ️ Automatisches Speichern ist hier nicht verfügbar – nutze im Menü <b>📋 Code</b>.';
  }else{
    const s=await loadGame();
    if(s&&s.team&&s.team.length){
      $('storageNote').textContent='✓ Speicher aktiv · Spielstand gefunden (Gebiet '+((s.area||0)+1)+').';
      const b=document.createElement('button');b.textContent='▶ Weiter (Spielstand laden)';
      b.style.width='100%';b.onclick=()=>{applySave(s);enterWorld();toast('Spielstand geladen! 💾');};
      $('screen-title').insertBefore(b,$('starterRow'));
    }else $('storageNote').textContent='✓ Speicher aktiv · noch kein Spielstand.';
  }
}

// ============================ OVERWORLD ============================
const TILE=22,VW=16,VH=16;
const wctx=$('worldCanvas').getContext('2d');
// Aktueller Ort: 'stadt' | 'route' | 'arena'
function locRows(){
  if(state.loc==='protown')return PROLOGUE_TOWN.rows;
  if(state.loc==='proroute')return PROLOGUE_ROUTE.rows;
  if(state.loc==='stadt')return CITY_DEFS[state.area].rows;
  if(state.loc==='arena')return arenaRows();
  if(state.loc==='side')return SIDE_AREAS[state.sideId].rows;
  return ROUTES[state.area].rows;
}
// Aktueller Hallenmeister-Schlüssel (fuer normale Hallen der Boss, in der Liga Champion Vera)
function currentArenaBossKey(){
  if(state.area===7)return '7-4';
  const b=arenaBoss();return b?b.key:null;
}
function arenaBossDone(){const k=currentArenaBossKey();return k?isDone(k):false;}
// Nach Meister-Sieg bleibt die Halle dauerhaft geloest: Raetsel-Kacheln werden zu normalem Boden,
// Waende/Tuer/Eingang bleiben erhalten.
function arenaRows(){
  const base=ARENA_DEFS[state.area].rows;
  if(!arenaBossDone())return base;
  return base.map(r=>r.split('').map(ch=>'BDA'.includes(ch)?ch:'F').join(''));
}
// Rätsel-Zustand pro Hallenbesuch initialisieren
function initArenaPuzzle(area){
  if(area===0){
    state.arenaPuzzle={kind:'sokoban',
      blocks:[[8,12],[15,12],[4,8]],
      targets:[[8,7],[15,7],[11,8]]};
  }else if(area===1){
    state.arenaPuzzle={kind:'fog',seen:new Set()};
    revealFog(10,16);
  }else if(area===2){
    state.arenaPuzzle={kind:'tide'};
  }else if(area===4){
    state.arenaPuzzle={kind:'lava'};
  }else if(area===5){
    state.arenaPuzzle={kind:'illusion',revealed:new Set()};
  }else if(area===7){
    state.arenaPuzzle={kind:'tide'};
  }else{
    state.arenaPuzzle=null;
  }
}
function revealFog(px,py){
  const p=state.arenaPuzzle;
  if(!p||p.kind!=='fog')return;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)p.seen.add((px+dx)+','+(py+dy));
}
// Gezeiten/Lava-Timing: Zone Q ist bei Phase 0-1 geflutet, Zone R bei Phase 1-2.
// Beide gleichzeitig trocken nur bei Phase 3.
function tidePhase(){return Math.floor(wfx.t/2)%4;}
function tideWet(zoneChar){
  const ph=tidePhase();
  if(zoneChar==='Q'||zoneChar==='q')return ph===0||ph===1;
  if(zoneChar==='R'||zoneChar==='r')return ph===1||ph===2;
  return false;
}
// Prüft, ob der Spieler gerade von der Flut/Lava erwischt wird, und setzt ihn zum Eingang zurück
function checkTideCatch(){
  if(state.mode!=='world'||state.loc!=='arena')return;
  const p=state.arenaPuzzle;
  if(!p||(p.kind!=='tide'&&p.kind!=='lava'))return;
  const t=tileAt(state.px,state.py);
  if((t==='Q'||t==='R'||t==='q'||t==='r')&&tideWet(t)){
    const label=p.kind==='tide'?'Die Flut erwischt dich!':'Die Lava erwischt dich!';
    state.px=10;state.py=15;
    toast('🌊 '+label+' Zurück zum Eingang.',2400);
    drawWorld();
  }
}
function checkSokobanSolved(){
  const p=state.arenaPuzzle;
  if(!p||p.kind!=='sokoban')return;
  const solved=p.targets.every(t=>p.blocks.some(b=>b[0]===t[0]&&b[1]===t[1]));
  if(solved&&!arenaGateOpen){
    arenaGateOpen=true;
    toast('🔵 Alle Steine liegen richtig – das Tor zum Meister öffnet sich!',2600);
  }
}
function locName(){
  if(state.loc==='protown')return PROLOGUE_TOWN.name;
  if(state.loc==='proroute')return 'Weg nach Mooshain';
  if(state.loc==='stadt')return CITY_NAMES[state.area];
  if(state.loc==='arena')return ARENA_NAMES[state.area];
  if(state.loc==='side')return SIDE_AREAS[state.sideId].name;
  return 'Route '+(state.area+1);
}
const tileAt=(x,y)=>{const m=locRows();return(x<0||y<0||y>=m.length||x>=m[0].length)?'T':m[y][x];};
// Wie viele Hallen-Herausforderer stehen vor dem Meister?
function arenaCount(){return Math.min(5,state.area+1);}
function arenaTrainers(){
  const a=state.area,n=arenaCount(),list=[];
  for(let i=0;i<n;i++){
    const lvl=Math.max(3,AREA_DEFS[a].cap-6+i*2);
    list.push({key:'arena-'+a+'-'+i,pos:ARENA_DEFS[a].pos[i],name:ARENA_TR_NAMES[a][i],
      kind:'normal',smart:a>=4,order:i,
      team:genTeam(AREA_DEFS[a].roster,lvl,Math.min(3,1+Math.floor(a/3))),
      pal:TR_PALS[i%5],lvl:lvl,
      intro:ARENA_TR_NAMES[a][i]+': "Du kommst hier nicht einfach durch!"',
      win:ARENA_TR_NAMES[a][i]+': "Zieh weiter – der Meister wartet."'});
  }
  return list;
}
function arenaBoss(){
  const t=AREAS[state.area].trainers.find(x=>x.key.endsWith('boss'))||AREAS[state.area].trainers[0];
  return t?Object.assign({},t,{pos:ARENA_DEFS[state.area].boss}):null;
}
function ligaTrainers(){
  return AREAS[7].trainers.map((t,i)=>Object.assign({},t,{pos:ARENA_DEFS[7].pos[i]||ARENA_DEFS[7].boss,order:i}));
}
// Alle Personen am aktuellen Ort
function hierTrainers(){
  if(state.loc==='proroute'){
    return PROLOGUE_ROUTE.trainers.map(t=>Object.assign({},t,{kind:'normal',smart:false,pal:TR_PALS[0],lvl:t.team[0].lvl}));
  }
  if(state.loc==='arena'){
    if(state.area===7)return ligaTrainers();
    const l=arenaTrainers();const b=arenaBoss();
    if(b)l.push(Object.assign({},b,{istMeister:true}));
    return l;
  }
  if(state.loc==='route'){
    const r=ROUTES[state.area],list=[];
    if(state.area===7){
      list.push(...ligaRouteTrainers());
    }else{
      AREAS[state.area].trainers.filter(t=>!t.key.endsWith('boss')).forEach((t,i)=>{
        if(r.trainers[i])list.push(Object.assign({},t,{pos:r.trainers[i]}));
      });
    }
    (ROUTE_FORK_TRAINERS[state.area]||[]).forEach(t=>list.push(t));
    const rv=rivalFor(state.area);
    if(rv&&r.rival)list.push(Object.assign({},rv,{pos:r.rival}));
    const fb=fabianFor(state.area);
    if(fb)list.push(fb);
    const gu=activeGuardian();
    if(gu)list.push(gu);
    return list;
  }
  return [];
}
function trainerAt(x,y){return hierTrainers().find(t=>t.pos&&t.pos[0]===x&&t.pos[1]===y);}
function npcAt(x,y){
  if(state.loc==='protown'){
    for(let i=0;i<PROLOGUE_NPCS.length;i++){
      const p=PROLOGUE_NPCS[i].pos;
      if(p&&p[0]===x&&p[1]===y)return Object.assign({},PROLOGUE_NPCS[i],{idx:i,key:PROLOGUE_NPCS[i].key||('pro-npc-'+i)});
    }
    return null;
  }
  if(state.loc==='stadt'){
    const liste=NPC_DATA[state.area]||[];
    const posArr=CITY_DEFS[state.area].npcs;
    for(let i=0;i<liste.length;i++){
      const p=posArr[i];
      if(p&&p[0]===x&&p[1]===y)return Object.assign({},liste[i],{idx:i});
    }
    return null;
  }
  if(state.loc==='side'){
    const sa=SIDE_AREAS[state.sideId];
    const liste=(sa&&sa.npcs)||[];
    for(let i=0;i<liste.length;i++){
      const p=liste[i].pos;
      if(p&&p[0]===x&&p[1]===y)return Object.assign({},liste[i],{idx:i,key:liste[i].key||('side-'+state.sideId+'-'+i)});
    }
    return null;
  }
  if(state.loc==='route'){
    const liste=ROUTE_NPCS[state.area]||[];
    for(let i=0;i<liste.length;i++){
      const p=liste[i].pos;
      if(p&&p[0]===x&&p[1]===y)return Object.assign({},liste[i],{idx:i,key:liste[i].key||('route-'+state.area+'-'+i)});
    }
    return null;
  }
  return null;
}
const isDone=k=>state.defeated.indexOf(k)>=0;
function bossCleared(){return arenaCleared(state.area);}
function activeLegend2(){return state.loc==='route'?activeLegend():null;}
// Wächter-Trainer: führt das jeweilige legendäre Kryptid im Team. Erst nach seiner
// Niederlage wird das wilde Legendäre auf der Karte überhaupt sichtbar.
const GUARDIAN_DATA={
  1:{name:'Hüterin Sylva',
     intro:'Hüterin Sylva tritt aus dem dichtesten Teil des Waldes: "Du hast die Zeichen gelesen. Aber der Wald prüft dich, bevor er dir vertraut."',
     win:'Hüterin Sylva: "...Der Wald hat entschieden. Geh weiter, wenn du bereit bist."',
     allies:['blattlon','spukrator']},
  3:{name:'Sturmwächter Kael',
     intro:'Sturmwächter Kael blickt in die aufziehenden Wolken: "Der Sturm wählt seine Zeugen selbst. Zeig mir, ob du einer bist."',
     win:'Sturmwächter Kael: "...Der Sturm ist zufrieden. Geh."',
     allies:['zapptitan','flatterax']},
  5:{name:'Nebelweberin Yssa',
     intro:'Nebelweberin Yssa erscheint wie aus dem Nichts: "Wer bis hierher kommt, hat das Recht auf eine letzte Prüfung verdient."',
     win:'Nebelweberin Yssa: "...Der Nebel öffnet sich für dich."',
     allies:['giftkralle','drakon']},
  7:{name:'Wächter der Krone',
     intro:'Ein namenloser Wächter versperrt den letzten Weg: "Nur wer alles hinter sich gelassen hat, darf weiter."',
     win:'Wächter der Krone: "...Geh. Was jetzt kommt, liegt zwischen dir und der Ewigkeit."',
     allies:['draconar','erzkoloss']}
};
const GUARDIAN_QUEST_ID={1:'q1',3:'q3',5:'q5',7:'q7'};
function activeGuardian(){
  if(state.loc!=='route')return null;
  const a=state.area,gd=GUARDIAN_DATA[a];
  if(!gd||isDone('guardian-'+a))return null;
  if((state.quests||{})[GUARDIAN_QUEST_ID[a]]!=='guardian')return null;
  const L=legendFor(a);if(!L)return null;
  const cap=AREA_DEFS[a].cap;
  const team=gd.allies.map(id=>({id,lvl:cap})).concat([{id:L.id,lvl:cap+1}]);
  return{key:'guardian-'+a,pos:L.pos,name:gd.name,kind:'boss',smart:true,dbl:false,
    team,pal:BOSS_PAL,lvl:cap+1,intro:gd.intro,win:gd.win};
}
function activeLegend(){
  const L=legendFor(state.area);
  if(!L||state.legends.indexOf(L.key)>=0)return null;
  if(GUARDIAN_DATA[state.area]&&!isDone('guardian-'+state.area))return null;
  return L;
}
function nordOffen(){
  // Aus der Stadt auf die Route: immer offen (dort trainiert man)
  if(state.loc==='stadt')return true;
  // Von der Route in die nächste Stadt: erst nach der Halle
  if(state.loc==='route')return arenaCleared(state.area);
  return true;
}
function arenaCleared(a){
  if(a===7)return AREAS[7].trainers.every(t=>isDone(t.key));
  return isDone(a+'-boss');
}
function isBlocked(x,y){
  const t=tileAt(x,y);
  if(t==='J')return true;   // Trugbild-Sackgasse: sieht aus wie Boden, ist aber blockiert
  if(t==='E'){}             // Trugbild-Wand: sieht aus wie Mauer, ist aber begehbar - NICHT blockiert
  else if(t==='T'||t==='W'||t==='B'||t==='O'||t==='U'||t==='L')return true;
  if(t==='Y'&&!arenaGateOpen)return true;
  if(state.loc==='arena'&&state.arenaPuzzle&&state.arenaPuzzle.kind==='sokoban'&&!arenaBossDone()){
    if(state.arenaPuzzle.blocks.some(b=>b[0]===x&&b[1]===y))return true;
  }
  const tr=trainerAt(x,y);
  if(tr&&!isDone(tr.key))return true;
  if(npcAt(x,y))return true;
  const L=activeLegend();
  if(L&&L.pos[0]===x&&L.pos[1]===y)return true;
  return false;
}
// deterministischer Pseudo-Zufall pro Kachel
function h2(x,y){
  let n=Math.imul(x,73856093)^Math.imul(y,19349663);
  n=Math.imul(n^(n>>>15),2246822519);
  n=Math.imul(n^(n>>>13),3266489917);
  n^=n>>>16;
  return(n>>>0)/4294967296;
}

// ---- Oberwelt-Animation ----
const wfx={t:0,raf:null,last:0,anim:null,step:0};
function worldLoop(ts){
  if(state.mode!=='world'){wfx.raf=null;return;}
  const dt=Math.min(.05,(ts-(wfx.last||ts))/1000);wfx.last=ts;wfx.t+=dt;
  if(wfx.anim){wfx.anim.k+=dt/0.13;if(wfx.anim.k>=1)wfx.anim=null;}
  if(!moveLock)checkTideCatch();
  drawWorld();
  wfx.raf=requestAnimationFrame(worldLoop);
}
function startWorldLoop(){wfx.last=0;if(!wfx.raf)wfx.raf=requestAnimationFrame(worldLoop);}

function drawTile(t,sx,sy,gx,gy){
  const S=areaDef().style,r=h2(gx,gy);
  const base=r>.5?S.grass:S.grass2;
  switch(t){
    case '.':
      wctx.fillStyle=base;wctx.fillRect(sx,sy,TILE+1,TILE+1);
      if(r>.88){
        const sway=Math.sin(wfx.t*2.2+gx*.8)*1.2;
        wctx.fillStyle=S.tall;wctx.fillRect(sx+6+sway,sy+13,2,5);
      }else if(r<.06){
        wctx.fillStyle='#f2e8a0';wctx.fillRect(sx+9,sy+10,3,3);
        wctx.fillStyle='#e8b93c';wctx.fillRect(sx+10,sy+11,1,1);
      }else if(r>.62&&r<.66){
        wctx.fillStyle=shade(base,.9);wctx.fillRect(sx+13,sy+6,4,3);
      }
      break;
    case ',':{
      wctx.fillStyle=r>.5?S.tall:S.tall2;wctx.fillRect(sx,sy,TILE+1,TILE+1);
      const sw=Math.sin(wfx.t*2.6+gx*.7+gy*.4)*1.6;
      wctx.fillStyle=shade(S.tall2,.72);
      wctx.fillRect(sx+3+sw*.5,sy+11,2,8);wctx.fillRect(sx+9+sw,sy+6,2,13);wctx.fillRect(sx+15+sw*.7,sy+11,2,8);
      wctx.fillStyle=shade(S.tall,1.25);
      wctx.fillRect(sx+3+sw*.5,sy+11,2,3);wctx.fillRect(sx+9+sw,sy+6,2,3);wctx.fillRect(sx+15+sw*.7,sy+11,2,3);
      break;}
    case 'P':
      wctx.fillStyle=S.path;wctx.fillRect(sx,sy,TILE+1,TILE+1);
      wctx.fillStyle=shade(S.path,.92);
      if(r>.6)wctx.fillRect(sx+4,sy+5,4,3);
      if(r<.35)wctx.fillRect(sx+13,sy+14,4,3);
      wctx.fillStyle=shade(S.path,.86);
      wctx.fillRect(sx,sy,TILE+1,1);
      break;
    case 'W':{
      wctx.fillStyle=S.water;wctx.fillRect(sx,sy,TILE+1,TILE+1);
      const ph=wfx.t*1.6+gx*.5+gy*.3;
      wctx.fillStyle=shade(S.water,1.45);
      wctx.fillRect(sx+3+Math.sin(ph)*2,sy+6,7,2);
      wctx.fillRect(sx+11+Math.sin(ph+1.7)*2,sy+14,7,2);
      wctx.fillStyle=shade(S.water,.8);
      wctx.fillRect(sx+5+Math.sin(ph+.8)*2,sy+11,5,1);
      break;}
    case 'T':{
      wctx.fillStyle=base;wctx.fillRect(sx,sy,TILE+1,TILE+1);
      wctx.fillStyle='rgba(20,14,30,.22)';
      wctx.beginPath();wctx.ellipse(sx+11,sy+19,7.5,2.6,0,0,Math.PI*2);wctx.fill();
      wctx.fillStyle=S.trunk;wctx.fillRect(sx+9,sy+12,4,7);
      wctx.fillStyle=shade(S.trunk,.8);wctx.fillRect(sx+9,sy+12,1,7);
      const sway=Math.sin(wfx.t*1.3+gx*.6)*.8;
      wctx.fillStyle=S.tree;
      wctx.beginPath();wctx.arc(sx+11+sway,sy+9,8.5,0,Math.PI*2);wctx.fill();
      wctx.fillStyle=S.tree2;
      wctx.beginPath();wctx.arc(sx+8+sway,sy+7,4.8,0,Math.PI*2);wctx.fill();
      wctx.fillStyle=shade(S.tree,.75);
      wctx.beginPath();wctx.arc(sx+14+sway,sy+12,3.4,0,Math.PI*2);wctx.fill();
      break;}
    case 'C':{   // Zugang zu einem Nebenbereich
      const linkedId=SIDE_LINK[state.area+':'+gx+':'+gy];
      const isCave=linkedId&&SIDE_AREAS[linkedId]&&SIDE_AREAS[linkedId].cave;
      if(isCave){
        wctx.fillStyle=base;wctx.fillRect(sx,sy,TILE+1,TILE+1);
        wctx.fillStyle='rgba(20,14,20,.5)';
        wctx.beginPath();wctx.ellipse(sx+11,sy+14,7,7,0,Math.PI,0,true);wctx.fill();
        wctx.fillStyle='#181220';
        wctx.beginPath();wctx.ellipse(sx+11,sy+15,4,5.5,0,Math.PI,0,true);wctx.fill();
        wctx.fillStyle=shade(S.tree,1.05);
        wctx.beginPath();wctx.arc(sx+4,sy+15,4,0,Math.PI*2);wctx.fill();
        wctx.beginPath();wctx.arc(sx+18,sy+14,4.4,0,Math.PI*2);wctx.fill();
      }else{
        // Pfad-Abzweigung nach Osten/Westen, im selben Stil wie die Nord/Süd-Ausgänge
        wctx.fillStyle=shade(S.path,.86);wctx.fillRect(sx,sy,TILE+1,TILE+1);
        wctx.fillStyle='#2e2448';wctx.fillRect(sx+2,sy+8,TILE-3,7);
        wctx.fillStyle='#7fe0a0';wctx.fillRect(sx+4,sy+10,TILE-7,3);
        wctx.fillStyle='rgba(0,0,0,.25)';wctx.fillRect(sx+4,sy+10,TILE-7,1);
      }
      break;}
    case 'K':{   // Holzbrücke (über Wasser)
      wctx.fillStyle=S.water;wctx.fillRect(sx,sy,TILE+1,TILE+1);
      wctx.fillStyle='#a07a4a';wctx.fillRect(sx,sy+3,TILE+1,TILE-6);
      wctx.fillStyle='#8a6238';
      for(let i=0;i<5;i++)wctx.fillRect(sx+1+i*4,sy+3,2,TILE-6);
      wctx.fillStyle='#6a4a2a';wctx.fillRect(sx,sy+2,TILE+1,2);wctx.fillRect(sx,sy+TILE-4,TILE+1,2);
      break;}
    case 'L':{   // Lava
      wctx.fillStyle='#7a1f10';wctx.fillRect(sx,sy,TILE+1,TILE+1);
      const lph=wfx.t*1.4+gx*.6+gy*.4;
      wctx.fillStyle='#c9401a';
      wctx.fillRect(sx+3+Math.sin(lph)*2,sy+6,7,3);
      wctx.fillRect(sx+11+Math.sin(lph+1.9)*2,sy+13,7,3);
      wctx.fillStyle='#f0a030';
      const glow=Math.sin(wfx.t*2.6+gx+gy)*.5+.5;
      wctx.fillRect(sx+6+Math.sin(lph+.6)*2,sy+10,4,2);
      wctx.fillStyle='rgba(255,180,70,'+(.15+glow*.25)+')';
      wctx.fillRect(sx,sy,TILE+1,TILE+1);
      break;}
    case 'O':{   // Stein
      wctx.fillStyle=base;wctx.fillRect(sx,sy,TILE+1,TILE+1);
      wctx.fillStyle='rgba(20,14,30,.2)';
      wctx.beginPath();wctx.ellipse(sx+11,sy+18,7,2.2,0,0,Math.PI*2);wctx.fill();
      wctx.fillStyle='#9a9088';
      wctx.beginPath();wctx.ellipse(sx+11,sy+13,8,6,0,0,Math.PI*2);wctx.fill();
      wctx.fillStyle='#7a726a';
      wctx.beginPath();wctx.ellipse(sx+13,sy+15,5,3.6,0,0,Math.PI*2);wctx.fill();
      wctx.fillStyle='#b8b0a6';
      wctx.beginPath();wctx.ellipse(sx+8,sy+10,3,2.2,.4,0,Math.PI*2);wctx.fill();
      break;}
    case 'U':{   // Busch
      wctx.fillStyle=base;wctx.fillRect(sx,sy,TILE+1,TILE+1);
      wctx.fillStyle='rgba(20,14,30,.2)';
      wctx.beginPath();wctx.ellipse(sx+11,sy+18,7,2.2,0,0,Math.PI*2);wctx.fill();
      const bsw=Math.sin(wfx.t*1.8+gx*.9)*.6;
      wctx.fillStyle=S.tree2;
      wctx.beginPath();wctx.arc(sx+7+bsw,sy+13,5,0,Math.PI*2);wctx.fill();
      wctx.beginPath();wctx.arc(sx+15+bsw,sy+13,5,0,Math.PI*2);wctx.fill();
      wctx.fillStyle=S.tree;
      wctx.beginPath();wctx.arc(sx+11+bsw,sy+11,5.6,0,Math.PI*2);wctx.fill();
      wctx.fillStyle=shade(S.tree,1.3);
      wctx.beginPath();wctx.arc(sx+9+bsw,sy+9,2.2,0,Math.PI*2);wctx.fill();
      break;}
    case 'M':{   // Blumenwiese
      wctx.fillStyle=base;wctx.fillRect(sx,sy,TILE+1,TILE+1);
      const petals=['#f2789c','#f2e8a0','#c9a0f2','#9adcf0'];
      const spots=[[5,6],[15,5],[10,12],[16,14],[6,15]];
      spots.forEach((p,i)=>{
        const bob=Math.sin(wfx.t*2+gx+gy+i)*.6;
        wctx.fillStyle=shade(S.tall,1.1);wctx.fillRect(sx+p[0]+1,sy+p[1]+bob+2,1,3);
        wctx.fillStyle=petals[(i+gx+gy)%petals.length];
        wctx.fillRect(sx+p[0],sy+p[1]+bob,3,3);
      });
      break;}
    case 'V':{   // Hügel
      wctx.fillStyle=base;wctx.fillRect(sx,sy,TILE+1,TILE+1);
      wctx.fillStyle=shade(S.grass2,.85);
      wctx.beginPath();wctx.ellipse(sx+11,sy+14,11,7,0,0,Math.PI*2);wctx.fill();
      wctx.fillStyle=shade(S.grass,1.18);
      wctx.beginPath();wctx.ellipse(sx+9,sy+10,7,4.6,0,0,Math.PI*2);wctx.fill();
      if(r>.85){
        wctx.fillStyle=S.tall;
        wctx.fillRect(sx+14+Math.sin(wfx.t*2+gx)*1,sy+8,2,4);
      }
      break;}
    case 'B':{   // Gebäudewand
      wctx.fillStyle=shade(S.path,.72);wctx.fillRect(sx,sy,TILE+1,TILE+1);
      wctx.fillStyle=shade(S.path,.62);
      wctx.fillRect(sx,sy,TILE+1,2);wctx.fillRect(sx,sy+TILE-2,TILE+1,2);
      if(r>.6){wctx.fillStyle='#9fd0e8';wctx.fillRect(sx+6,sy+6,9,7);
        wctx.fillStyle='rgba(255,255,255,.55)';wctx.fillRect(sx+6,sy+6,9,2);}
      break;}
    case 'F':{   // Hallenboden
      wctx.fillStyle=((gx+gy)%2)?shade(S.path,.9):shade(S.path,.82);
      wctx.fillRect(sx,sy,TILE+1,TILE+1);
      break;}
    case 'Q': case 'R':{   // Gezeitenfeld
      const wet=tideWet(t);
      wctx.fillStyle=wet?'#2c6a9c':shade(S.path,.86);
      wctx.fillRect(sx,sy,TILE+1,TILE+1);
      if(wet){
        wctx.fillStyle='rgba(255,255,255,.25)';
        const o=Math.sin(wfx.t*3+gx)*2;
        wctx.fillRect(sx+2,sy+9+o,TILE-4,2);
      }else{
        wctx.strokeStyle='rgba(60,100,140,.4)';wctx.lineWidth=1;
        wctx.strokeRect(sx+3,sy+3,TILE-6,TILE-6);
      }
      break;}
    case 'q': case 'r':{   // Lavafeld (Timing wie Gezeiten, andere Optik)
      const molten=tideWet(t);
      wctx.fillStyle=molten?'#c9401c':shade('#5a4436',.86);
      wctx.fillRect(sx,sy,TILE+1,TILE+1);
      if(molten){
        wctx.fillStyle='rgba(255,200,80,.4)';
        const o=Math.sin(wfx.t*4+gx*1.3)*2;
        wctx.fillRect(sx+3,sy+8+o,TILE-6,3);
      }else{
        wctx.strokeStyle='rgba(90,60,30,.5)';wctx.lineWidth=1;
        wctx.strokeRect(sx+3,sy+3,TILE-6,TILE-6);
      }
      break;}
    case 'E':{   // Trugbild-Wand: sieht wie Mauer aus, ist begehbar
      const revealed=state.arenaPuzzle&&state.arenaPuzzle.revealed&&state.arenaPuzzle.revealed.has(gx+','+gy);
      if(revealed){
        wctx.fillStyle=((gx+gy)%2)?shade(S.path,.9):shade(S.path,.82);
        wctx.fillRect(sx,sy,TILE+1,TILE+1);
        wctx.strokeStyle='rgba(180,220,180,.6)';wctx.lineWidth=2;
        wctx.strokeRect(sx+2,sy+2,TILE-3,TILE-3);
      }else{
        wctx.fillStyle='#3a3a48';wctx.fillRect(sx,sy,TILE+1,TILE+1);
        wctx.fillStyle='#2a2a36';wctx.fillRect(sx+2,sy+2,TILE-5,TILE-5);
      }
      break;}
    case 'J':{   // Trugbild-Boden: sieht wie normaler Boden aus, ist blockiert
      const revealed=state.arenaPuzzle&&state.arenaPuzzle.revealed&&state.arenaPuzzle.revealed.has(gx+','+gy);
      wctx.fillStyle=((gx+gy)%2)?shade(S.path,.9):shade(S.path,.82);
      wctx.fillRect(sx,sy,TILE+1,TILE+1);
      if(revealed){
        wctx.strokeStyle='rgba(200,90,90,.6)';wctx.lineWidth=2;
        wctx.beginPath();wctx.moveTo(sx+4,sy+4);wctx.lineTo(sx+TILE-4,sy+TILE-4);
        wctx.moveTo(sx+TILE-4,sy+4);wctx.lineTo(sx+4,sy+TILE-4);wctx.stroke();
      }
      break;}
    case 'Z':{   // Sokoban-Zielfeld
      wctx.fillStyle=((gx+gy)%2)?shade(S.path,.9):shade(S.path,.82);
      wctx.fillRect(sx,sy,TILE+1,TILE+1);
      const onTarget=state.arenaPuzzle&&state.arenaPuzzle.blocks&&state.arenaPuzzle.blocks.some(b=>b[0]===gx&&b[1]===gy);
      wctx.strokeStyle=onTarget?'#5aa464':'#e8b93c';wctx.lineWidth=2;
      wctx.strokeRect(sx+4,sy+4,TILE-7,TILE-7);
      break;}
    case 'I':{   // Eisfläche (Rätsel: rutscht in Bewegungsrichtung weiter)
      wctx.fillStyle='#cdeaf5';wctx.fillRect(sx,sy,TILE+1,TILE+1);
      wctx.fillStyle='rgba(255,255,255,.55)';
      wctx.fillRect(sx+2,sy+2,TILE-6,2);
      wctx.strokeStyle='rgba(150,200,220,.6)';wctx.lineWidth=1;
      wctx.beginPath();wctx.moveTo(sx+3,sy+TILE-4);wctx.lineTo(sx+9,sy+TILE-11);wctx.lineTo(sx+15,sy+TILE-5);wctx.stroke();
      wctx.fillStyle='rgba(210,240,250,.5)';wctx.fillRect(sx,sy,TILE+1,TILE+1);
      break;}
    case '^': case 'v': case '<': case '>':{   // Windfeld (Rätsel: schiebt automatisch in Pfeilrichtung)
      wctx.fillStyle=shade(S.path,.86);wctx.fillRect(sx,sy,TILE+1,TILE+1);
      const ph=(wfx.t*1.6+gx*.4+gy*.4)%1;
      wctx.strokeStyle='rgba(255,255,255,.65)';wctx.lineWidth=2;
      for(let i=0;i<3;i++){
        const o=((ph+i/3)%1)*TILE;
        wctx.beginPath();
        if(t==='^'){wctx.moveTo(sx+6,sy+TILE-o);wctx.lineTo(sx+11,sy+TILE-o-6);wctx.lineTo(sx+16,sy+TILE-o);}
        else if(t==='v'){wctx.moveTo(sx+6,sy+o);wctx.lineTo(sx+11,sy+o+6);wctx.lineTo(sx+16,sy+o);}
        else if(t==='<'){wctx.moveTo(sx+TILE-o,sy+6);wctx.lineTo(sx+TILE-o-6,sy+11);wctx.lineTo(sx+TILE-o,sy+16);}
        else{wctx.moveTo(sx+o,sy+6);wctx.lineTo(sx+o+6,sy+11);wctx.lineTo(sx+o,sy+16);}
        wctx.stroke();
      }
      break;}
    case 'X':{   // Schalter (Rätsel: öffnet/schließt das Tor an anderer Stelle)
      wctx.fillStyle=shade(S.path,.82);wctx.fillRect(sx,sy,TILE+1,TILE+1);
      wctx.fillStyle='#6a6050';wctx.beginPath();wctx.arc(sx+11,sy+12,8,0,Math.PI*2);wctx.fill();
      wctx.fillStyle=arenaGateOpen?'#5aa464':'#c94f6d';
      const pulse=Math.sin(wfx.t*3)*.5+.5;
      wctx.beginPath();wctx.arc(sx+11,sy+11,4+pulse*1.2,0,Math.PI*2);wctx.fill();
      break;}
    case 'Y':{   // Tor/Barriere (schließt sich per Schalter)
      wctx.fillStyle=shade(S.path,.82);wctx.fillRect(sx,sy,TILE+1,TILE+1);
      if(arenaGateOpen){
        wctx.fillStyle='rgba(90,164,100,.3)';wctx.fillRect(sx+2,sy+2,TILE-4,TILE-4);
        wctx.strokeStyle='rgba(90,164,100,.7)';wctx.strokeRect(sx+2,sy+2,TILE-4,TILE-4);
      }else{
        const pulse=Math.sin(wfx.t*4+gx)*.5+.5;
        wctx.fillStyle='rgba(201,79,109,'+(.35+pulse*.25)+')';wctx.fillRect(sx,sy,TILE+1,TILE+1);
        wctx.fillStyle='#8a6238';
        for(let i=0;i<4;i++)wctx.fillRect(sx+2,sy+2+i*5,TILE-4,2);
      }
      break;}
    case 'A':{   // Arenatür
      wctx.fillStyle=shade(S.path,.72);wctx.fillRect(sx,sy,TILE+1,TILE+1);
      wctx.fillStyle='#c9a24a';wctx.fillRect(sx+3,sy+4,TILE-6,TILE-4);
      wctx.fillStyle='#7a5f2a';wctx.fillRect(sx+3,sy+4,TILE-6,3);
      wctx.fillStyle='#f0d240';wctx.fillRect(sx+9,sy+11,4,4);
      break;}
    case 'D':{   // Ausgang aus der Halle
      wctx.fillStyle=shade(S.path,.82);wctx.fillRect(sx,sy,TILE+1,TILE+1);
      wctx.fillStyle='#7fe0a0';wctx.fillRect(sx+2,sy+3,TILE-4,TILE-6);
      wctx.fillStyle='rgba(0,0,0,.25)';wctx.fillRect(sx+2,sy+3,TILE-4,3);
      break;}
    case 'N': case 'S':{  // Orts-Ausgänge
      const offen=(t==='N')?nordOffen():true;
      wctx.fillStyle='#2e2448';wctx.fillRect(sx,sy,TILE+1,TILE+1);
      wctx.fillStyle=offen?'#7fe0a0':'#c94f6d';
      wctx.fillRect(sx+2,sy+3,18,16);
      wctx.fillStyle='rgba(0,0,0,.28)';wctx.fillRect(sx+2,sy+3,18,3);
      break;}
    case 'H':
      wctx.fillStyle='#f5efe0';wctx.fillRect(sx,sy,TILE+1,TILE+1);
      wctx.fillStyle=shade('#f5efe0',.9);wctx.fillRect(sx,sy+TILE-3,TILE+1,3);
      wctx.fillStyle='#c94f6d';wctx.fillRect(sx,sy,TILE+1,7);
      wctx.fillStyle=shade('#c94f6d',.8);wctx.fillRect(sx,sy+6,TILE+1,1);
      if(r>.5){wctx.fillStyle='#c94f6d';wctx.fillRect(sx+9,sy+11,4,8);wctx.fillRect(sx+7,sy+13,8,4);}
      else{wctx.fillStyle='#9fd0e8';wctx.fillRect(sx+5,sy+11,12,7);
        wctx.fillStyle='rgba(255,255,255,.6)';wctx.fillRect(sx+5,sy+11,12,2);}
      break;
    case 'G':{
      wctx.fillStyle='#2e2448';wctx.fillRect(sx,sy,TILE+1,TILE+1);
      const open=bossCleared();
      const glow=open?(Math.sin(wfx.t*2.4)*.5+.5):0;
      wctx.fillStyle=open?'#7fe0a0':'#c94f6d';
      wctx.fillRect(sx+2,sy+3,18,16);
      if(open){wctx.fillStyle='rgba(255,255,255,'+(glow*.45)+')';wctx.fillRect(sx+2,sy+3,18,16);}
      wctx.fillStyle='rgba(0,0,0,.28)';wctx.fillRect(sx+2,sy+3,18,3);
      wctx.fillStyle='rgba(255,255,255,.35)';wctx.fillRect(sx+9,sy+7,3,9);
      break;}
    default:
      wctx.fillStyle=base;wctx.fillRect(sx,sy,TILE+1,TILE+1);
  }
}
// ---- Natur-Ambiente: Wetter- und Stimmungseffekte pro Gebiet ----
// Alle Partikel werden relativ zur Kamera (Weltposition) verschoben statt fest am
// Bildschirm zu kleben – sonst wirkt es, als würden sie dem Spieler folgen.
const wrap=(v,n)=>((v%n)+n)%n;
function fxRain(W,H,ox,oy){
  wctx.fillStyle='rgba(60,80,120,.07)';wctx.fillRect(0,0,W,H);
  wctx.strokeStyle='rgba(210,225,255,.55)';wctx.lineWidth=1.3;
  for(let i=0;i<44;i++){
    const x=wrap(h2(i,31)*W+wfx.t*36-ox,W+20)-10;
    const y=wrap(h2(i,32)*H+wfx.t*280-oy,H);
    wctx.beginPath();wctx.moveTo(x,y);wctx.lineTo(x-3,y+11);wctx.stroke();
  }
}
function fxSnow(W,H,ox,oy){
  wctx.fillStyle='rgba(255,255,255,.92)';
  for(let i=0;i<30;i++){
    const speed=16+h2(i,33)*14;
    const bx=h2(i,34)*W,sway=Math.sin(wfx.t*1.1+i*1.7)*7;
    const x=wrap(bx+sway-ox,W);
    const y=wrap(h2(i,35)*H+wfx.t*speed-oy,H);
    const r=1.1+h2(i,36)*1.5;
    wctx.beginPath();wctx.arc(x,y,r,0,Math.PI*2);wctx.fill();
  }
}
function fxFog(W,H,ox,oy){
  wctx.fillStyle='rgba(215,218,232,.10)';wctx.fillRect(0,0,W,H);
  for(let i=0;i<5;i++){
    const y=wrap(50+i*66+Math.sin(wfx.t*.3+i)*10-oy,H+140)-70;
    const x=wrap((h2(i,37)*W)+wfx.t*(9+i*3)-ox,W+180)-90;
    const grad=wctx.createRadialGradient(x,y,10,x,y,130);
    grad.addColorStop(0,'rgba(224,227,238,.30)');grad.addColorStop(1,'rgba(224,227,238,0)');
    wctx.fillStyle=grad;wctx.fillRect(x-130,y-70,260,140);
  }
}
function fxLeaves(W,H,c1,c2,ox,oy){
  for(let i=0;i<13;i++){
    const speed=20+h2(i,38)*14;
    const y=wrap(h2(i,39)*H+wfx.t*speed-oy,H);
    const sway=Math.sin(wfx.t*1.3+i*1.4)*15;
    const x=wrap(h2(i,40)*W+sway-ox,W);
    wctx.save();wctx.translate(x,y);wctx.rotate(wfx.t*1.5+i);
    wctx.fillStyle=(i%2===0)?c1:c2;wctx.fillRect(-3,-1.4,6,2.8);
    wctx.restore();
  }
}
function fxRays(W,H,ox,oy){
  for(let i=0;i<4;i++){
    const bx=wrap(W*(.12+i*.26)+Math.sin(wfx.t*.22+i)*10-ox,W+80)-40;
    const w=24+Math.sin(wfx.t*.4+i*2)*6;
    const alpha=.05+(Math.sin(wfx.t*.5+i)*.5+.5)*.05;
    const grad=wctx.createLinearGradient(bx,0,bx+40,H);
    grad.addColorStop(0,'rgba(255,248,210,'+(alpha+.06)+')');grad.addColorStop(1,'rgba(255,248,210,0)');
    wctx.fillStyle=grad;wctx.beginPath();
    wctx.moveTo(bx-w/2,0);wctx.lineTo(bx+w/2,0);wctx.lineTo(bx+w/2+46,H);wctx.lineTo(bx-w/2+46,H);
    wctx.closePath();wctx.fill();
  }
}
function fxDust(W,H,overlay,particle,ox,oy){
  wctx.fillStyle=overlay;wctx.fillRect(0,0,W,H);
  wctx.fillStyle=particle;
  for(let i=0;i<24;i++){
    const speed=32+h2(i,41)*42;
    const x=wrap(h2(i,42)*W+wfx.t*speed-ox,W+40)-20;
    const y=wrap(h2(i,43)*H+Math.sin(wfx.t*2+i)*6-oy,H);
    const r=.9+h2(i,44)*1.7;
    wctx.beginPath();wctx.arc(x,y,r,0,Math.PI*2);wctx.fill();
  }
}
function fxFireflies(W,H,col,ox,oy){
  for(let i=0;i<10;i++){
    const bx=wrap(h2(i,45)*W-ox,W),by=wrap((.28+h2(i,46)*.6)*H-oy,H);
    const x=bx+Math.sin(wfx.t*.8+i*2)*17;
    const y=by+Math.cos(wfx.t*.6+i*1.7)*13;
    const pulse=Math.sin(wfx.t*3+i*3)*.5+.5;
    wctx.fillStyle='rgba('+col+','+(.25+pulse*.55)+')';
    wctx.beginPath();wctx.arc(x,y,1.5+pulse*1.2,0,Math.PI*2);wctx.fill();
  }
}
function fxButterflies(W,H,ox,oy){
  const cols=['#f2e8a0','#f2789c','#f0f0f0','#e8b93c'];
  for(let i=0;i<8;i++){
    const bx=wrap(h2(i,47)*W-ox,W),by=wrap((.2+h2(i,48)*.65)*H-oy,H);
    const x=bx+Math.sin(wfx.t*1.1+i*2.1)*14+Math.sin(wfx.t*3.3+i)*3;
    const y=by+Math.sin(wfx.t*2.1+i*1.3)*8;
    const wing=Math.sin(wfx.t*9+i*4)*2.4;
    wctx.fillStyle=cols[i%cols.length];
    wctx.beginPath();wctx.ellipse(x-wing,y,2.4,1.6,.5,0,Math.PI*2);wctx.fill();
    wctx.beginPath();wctx.ellipse(x+wing,y,2.4,1.6,-.5,0,Math.PI*2);wctx.fill();
  }
}
function drawAmbient(camPX,camPY){
  if(state.loc==='arena')return;
  const list=areaDef().ambient;
  if(!list||!list.length)return;
  const W=VW*TILE,H=VH*TILE,S=areaDef().style;
  wctx.save();
  list.forEach(fx=>{
    if(fx==='rain')fxRain(W,H,camPX,camPY);
    else if(fx==='snow')fxSnow(W,H,camPX,camPY);
    else if(fx==='fog')fxFog(W,H,camPX,camPY);
    else if(fx==='leaves')fxLeaves(W,H,S.tree,S.tree2,camPX,camPY);
    else if(fx==='rays')fxRays(W,H,camPX,camPY);
    else if(fx==='dust')fxDust(W,H,'rgba(120,95,55,.06)','rgba(190,160,115,.55)',camPX,camPY);
    else if(fx==='ash')fxDust(W,H,'rgba(120,40,20,.07)','rgba(90,80,80,.6)',camPX,camPY);
    else if(fx==='fireflies')fxFireflies(W,H,'228,224,120',camPX,camPY);
    else if(fx==='irrlichter')fxFireflies(W,H,'186,140,232',camPX,camPY);
    else if(fx==='butterflies')fxButterflies(W,H,camPX,camPY);
  });
  wctx.restore();
}
function drawWorld(){
  const rows=locRows();
  // interpolierte Spielerposition für flüssiges Laufen
  let ppx=state.px,ppy=state.py;
  if(wfx.anim){const a=wfx.anim,k=Math.min(1,a.k);
    ppx=a.fx+(a.tx-a.fx)*k;ppy=a.fy+(a.ty-a.fy)*k;}
  let camX=ppx-(VW-1)/2,camY=ppy-(VH-1)/2;
  camX=Math.max(0,Math.min(rows[0].length-VW,camX));
  camY=Math.max(0,Math.min(rows.length-VH,camY));
  const x0=Math.floor(camX),y0=Math.floor(camY);
  const fogMode=state.loc==='arena'&&state.arenaPuzzle&&state.arenaPuzzle.kind==='fog';
  for(let y=y0-1;y<y0+VH+2;y++)for(let x=x0-1;x<x0+VW+2;x++){
    const sx2=Math.round((x-camX)*TILE),sy2=Math.round((y-camY)*TILE);
    if(fogMode&&!state.arenaPuzzle.seen.has(x+','+y)){
      wctx.fillStyle='#0a0a12';wctx.fillRect(sx2,sy2,TILE+1,TILE+1);
      continue;
    }
    drawTile(tileAt(x,y),sx2,sy2,x,y);
  }
  if(state.loc==='arena'&&state.arenaPuzzle&&state.arenaPuzzle.kind==='sokoban'&&!arenaBossDone()){
    state.arenaPuzzle.blocks.forEach(b=>{
      const sx=Math.round((b[0]-camX)*TILE),sy=Math.round((b[1]-camY)*TILE);
      if(sx<-TILE||sy<-TILE||sx>VW*TILE+TILE||sy>VH*TILE+TILE)return;
      wctx.fillStyle='#8a6a48';wctx.fillRect(sx+2,sy+2,TILE-5,TILE-5);
      wctx.strokeStyle='#4a3520';wctx.lineWidth=2;wctx.strokeRect(sx+2,sy+2,TILE-5,TILE-5);
      wctx.fillStyle='#c9a870';wctx.fillRect(sx+5,sy+5,TILE-11,TILE-11);
    });
  }
  hierTrainers().forEach(t=>{
    if(!t.pos)return;
    if(fogMode&&!state.arenaPuzzle.seen.has(t.pos[0]+','+t.pos[1]))return;
    const sx=Math.round((t.pos[0]-camX)*TILE),sy=Math.round((t.pos[1]-camY)*TILE);
    if(sx<-TILE*2||sy<-TILE*2||sx>VW*TILE+TILE||sy>VH*TILE+TILE)return;
    const done=isDone(t.key);
    if(done)wctx.globalAlpha=.42;
    const bob=done?0:Math.sin(wfx.t*1.8+t.pos[0])*.9;
    paintHuman(wctx,t.pal,sx-1,sy-1+bob,2);
    wctx.globalAlpha=1;
    if(!done&&(t.kind!=='normal'||t.dbl)){
      const pulse=Math.sin(wfx.t*4)*1.5;
      wctx.fillStyle=t.kind==='rival'?'#c94f6d':t.dbl?'#5fe0c0':'#f0d240';
      wctx.fillRect(sx+8,sy-7+pulse,6,4);
      if(t.dbl)wctx.fillRect(sx+15,sy-7+pulse,3,4);
    }
  });
  // Bewohner zeichnen
  if(state.loc==='protown'){
    PROLOGUE_NPCS.forEach((np,i)=>{
      const p2=np.pos;if(!p2)return;
      const sx=Math.round((p2[0]-camX)*TILE),sy=Math.round((p2[1]-camY)*TILE);
      if(sx<-TILE*2||sy<-TILE*2||sx>VW*TILE+TILE||sy>VH*TILE+TILE)return;
      const bob=Math.sin(wfx.t*1.5+i)*.8;
      paintHuman(wctx,NPC_PALS[i%NPC_PALS.length],sx-1,sy-1+bob,2);
    });
  }else if(state.loc==='stadt'){
    (NPC_DATA[state.area]||[]).forEach((np,i)=>{
      const p2=CITY_DEFS[state.area].npcs[i];if(!p2)return;
      const sx=Math.round((p2[0]-camX)*TILE),sy=Math.round((p2[1]-camY)*TILE);
      if(sx<-TILE*2||sy<-TILE*2||sx>VW*TILE+TILE||sy>VH*TILE+TILE)return;
      const bob=Math.sin(wfx.t*1.5+i)*.8;
      paintHuman(wctx,NPC_PALS[i%NPC_PALS.length],sx-1,sy-1+bob,2);
      if(np.gift&&(state.npcGifts||[]).indexOf(state.area+'-'+i)<0){
        const pulse=Math.sin(wfx.t*4)*1.5;
        wctx.fillStyle='#7fe0a0';wctx.fillRect(sx+8,sy-7+pulse,6,4);
      }
    });
  }else if(state.loc==='side'){
    const sa=SIDE_AREAS[state.sideId];
    ((sa&&sa.npcs)||[]).forEach((np,i)=>{
      const p2=np.pos;if(!p2)return;
      const sx=Math.round((p2[0]-camX)*TILE),sy=Math.round((p2[1]-camY)*TILE);
      if(sx<-TILE*2||sy<-TILE*2||sx>VW*TILE+TILE||sy>VH*TILE+TILE)return;
      if(np.kind==='stone'){
        wctx.fillStyle='rgba(20,14,30,.25)';
        wctx.beginPath();wctx.ellipse(sx+11,sy+19,8,3,0,0,Math.PI*2);wctx.fill();
        wctx.fillStyle='#6a6258';
        wctx.beginPath();wctx.moveTo(sx+6,sy+20);wctx.lineTo(sx+7,sy+2);wctx.lineTo(sx+15,sy+2);wctx.lineTo(sx+16,sy+20);wctx.closePath();wctx.fill();
        wctx.fillStyle='#8a8276';wctx.fillRect(sx+8,sy+4,3,14);
        const pulse=Math.sin(wfx.t*1.6)*.5+.5;
        wctx.fillStyle='rgba(160,200,255,'+(.25+pulse*.4)+')';
        wctx.fillRect(sx+9,sy+8,4,2);wctx.fillRect(sx+9,sy+13,4,2);
      }else if(np.kind==='shelf'){
        wctx.fillStyle='rgba(20,14,30,.25)';
        wctx.beginPath();wctx.ellipse(sx+11,sy+19,8,3,0,0,Math.PI*2);wctx.fill();
        wctx.fillStyle='#5a4a38';wctx.fillRect(sx+3,sy+3,16,17);
        wctx.fillStyle='#3e3226';wctx.fillRect(sx+4,sy+6,14,2);wctx.fillRect(sx+4,sy+12,14,2);
        const spineCols=['#8a3c3c','#3c6a8a','#8a7a3c','#4a7a4a'];
        for(let si=0;si<6;si++){wctx.fillStyle=spineCols[si%spineCols.length];wctx.fillRect(sx+4+si*2.2,sy+8,1.6,4);}
        wctx.fillStyle='rgba(200,190,160,.35)';wctx.fillRect(sx+3,sy+3,16,17);
      }else if(np.bondStarter){
        const bob=Math.sin(wfx.t*1.8+i)*1.5;
        const pulse=Math.sin(wfx.t*2.2)*.5+.5;
        wctx.fillStyle='rgba(255,230,140,'+(.12+pulse*.18)+')';
        wctx.beginPath();wctx.arc(sx+11,sy+13,13+pulse*2,0,Math.PI*2);wctx.fill();
        paintMon(wctx,np.bondStarter,sx-3,sy-3+bob,2,false,false);
      }else{
        const bob=Math.sin(wfx.t*1.5+i)*.8;
        paintHuman(wctx,NPC_PALS[i%NPC_PALS.length],sx-1,sy-1+bob,2);
      }
    });
  }else if(state.loc==='route'){
    (ROUTE_NPCS[state.area]||[]).forEach((np,i)=>{
      const p2=np.pos;if(!p2)return;
      const sx=Math.round((p2[0]-camX)*TILE),sy=Math.round((p2[1]-camY)*TILE);
      if(sx<-TILE*2||sy<-TILE*2||sx>VW*TILE+TILE||sy>VH*TILE+TILE)return;
      const bob=Math.sin(wfx.t*1.5+i)*.8;
      paintHuman(wctx,NPC_PALS[(i+3)%NPC_PALS.length],sx-1,sy-1+bob,2);
    });
  }
  // Legendäres Monster auf der Karte
  const LG=activeLegend2();
  if(LG){
    const sx=Math.round((LG.pos[0]-camX)*TILE),sy=Math.round((LG.pos[1]-camY)*TILE);
    if(sx>-TILE*2&&sy>-TILE*2&&sx<VW*TILE+TILE&&sy<VH*TILE+TILE){
      const pulse=Math.sin(wfx.t*2.6)*.5+.5;
      wctx.fillStyle='rgba(240,201,60,'+(.18+pulse*.3)+')';
      wctx.beginPath();wctx.arc(sx+11,sy+11,15+pulse*3,0,Math.PI*2);wctx.fill();
      const bob=Math.sin(wfx.t*1.9)*1.4;
      paintMon(wctx,LG.id,sx-1,Math.round(sy-3+bob),2,false,false);
      wctx.fillStyle='#f0d240';
      wctx.fillRect(sx+8,sy-9+Math.sin(wfx.t*4)*1.5,6,4);
    }
  }
  // Spieler mit Schrittwippen
  const walking=!!wfx.anim;
  const stepBob=walking?Math.abs(Math.sin(wfx.anim.k*Math.PI))*-2:0;
  drawSighting(camX,camY);
  paintHuman(wctx,HERO_PAL,Math.round((ppx-camX)*TILE)-1,Math.round((ppy-camY)*TILE)-1+stepBob,2);
  // Natur-Ambiente (Regen, Schnee, Nebel, Blätter, Lichtstrahlen, Glühwürmchen...)
  drawAmbient(camX*TILE,camY*TILE);
  // HUD
  const hg=wctx.createLinearGradient(0,0,0,22);
  hg.addColorStop(0,'rgba(28,20,44,.85)');hg.addColorStop(1,'rgba(28,20,44,.6)');
  wctx.fillStyle=hg;wctx.fillRect(0,0,VW*TILE,22);
  wctx.fillStyle='#fff';wctx.font='bold 10px "Courier New",monospace';wctx.textBaseline='middle';
  const WW=curWeather();
  let zusatz='';
  if(state.loc==='protown'||state.loc==='side'){
    zusatz='';
  }else if(state.loc==='proroute'){
    const liste=hierTrainers();
    zusatz='  Trainer '+liste.filter(t=>isDone(t.key)).length+'/'+liste.length;
  }else if(state.loc==='arena'){
    const liste=state.area===7?ligaTrainers():arenaTrainers().concat([arenaBoss()].filter(Boolean));
    const f=liste.filter(t=>t&&isDone(t.key)).length;
    zusatz='  Halle '+f+'/'+liste.length;
  }else if(state.loc==='route'){
    const liste=hierTrainers();
    zusatz='  Trainer '+liste.filter(t=>isDone(t.key)).length+'/'+liste.length;
  }else if(state.loc==='stadt'){
    zusatz=arenaCleared(state.area)?'  ✓ Halle bezwungen':'  ⚔️ Halle offen';
  }else{
    zusatz='';
  }
  if(state.loc==='route'&&!arenaCleared(state.area))zusatz+='  🔒 Nord';
  wctx.fillText(locName()+'  Lv≤'+effectiveCap()+zusatz+'  💰'+state.money+(WW?'  '+WW.icon:''),5,11);
}
function enterWorld(){
  window.__booted=true;
  if(state.loc==='arena'&&state.arenaPuzzle===undefined)initArenaPuzzle(state.area);
  showScreen('world');wfx.anim=null;startWorldLoop();drawWorld();
}
const FIND_POOL=['trank','bindungsstein','gegenmittel','supertrank','vertrauensstein','beleber','ueberreste','urtonikum'];
function hiddenFindAt(x,y){
  if(state.loc!=='route')return null;
  const t=tileAt(x,y);
  if(t!=='.'&&t!==',')return null;
  const r=h2(x*7+state.area*131,y*13+state.area*57);
  if(r<.962)return null;
  const i=Math.floor(((r-.962)/.038)*FIND_POOL.length);
  return FIND_POOL[Math.min(FIND_POOL.length-1,i)];
}
function checkFind(x,y){
  const it=hiddenFindAt(x,y);
  if(!it)return;
  const key=state.area+':'+x+':'+y;
  if(state.found.indexOf(key)>=0)return;
  state.found.push(key);
  addItem(it,1);
  toast('✨ Versteckter Fund: <b>'+ITEMS[it].name+'</b>!',2600);
  saveGame(true);
}
function healAll(){
  state.team.concat(state.box).forEach(m=>{m.hp=m.maxHp;m.status=null;restoreAP(m);});
}

// ============================ ZUFALLSEREIGNISSE ============================
// Nicht jede Begegnung ist ein Kampf: Fußspuren, Geräusche, Händler, Ruinen, Höhlen, seltene Pflanzen, Schätze.
const EVENT_TILES=new Set(['.',',','M','V','P']);
const EVENT_POOL=[
  {kind:'spuren',w:3},{kind:'geraeusch',w:3},{kind:'pflanze',w:2},
  {kind:'ruine',w:1},{kind:'hoehle',w:1},{kind:'haendler',w:1},{kind:'schatz',w:1}
];
const RARE_POOL=['heilkraut','ueberreste','schutzstein','schnellfeder','fokusgurt','machtband'];
const SOUND_LINES=[
  'Irgendwo im Dickicht raschelt es – und wird gleich wieder still.',
  'Ein leises Rufen hallt durch die Ferne. Niemand ist zu sehen.',
  'Für einen Moment glaubst du, Schritte hinter dir zu hören.',
  'Ein Windhauch trägt einen fremden Ton heran, dann ist er wieder weg.'
];
function runEvent(kind,x,y){
  const a=state.area;
  if(kind==='spuren'){
    const roster=AREAS[a].roster;
    const unseen=roster.filter(id=>state.seen.indexOf(id)<0);
    if(unseen.length){
      const id=unseen[Math.floor(h2(x+3,y+500+a)*unseen.length)];
      state.seen.push(id);
      toast('👣 Frische Fährten im Boden... <b>'+DEX[id].name+'</b> war hier!',3000);
    }else{
      toast('👣 Frische Fährten ziehen sich durchs Gras – doch die Spur verliert sich.',2600);
    }
  }else if(kind==='geraeusch'){
    const i=Math.floor(h2(x+7,y+700+a)*SOUND_LINES.length);
    toast('👂 '+SOUND_LINES[Math.min(SOUND_LINES.length-1,i)],2800);
  }else if(kind==='pflanze'){
    const i=Math.floor(h2(x+9,y+900+a)*RARE_POOL.length);
    const it=RARE_POOL[Math.min(RARE_POOL.length-1,i)];
    addItem(it,1);
    toast('🌿 Am Wegesrand wächst eine seltene Pflanze: <b>'+ITEMS[it].name+'</b>!',3000);
  }else if(kind==='ruine'){
    const g=20+Math.floor(h2(x+11,y+1100+a)*60);
    state.money+=g;
    toast('🏛️ Zwischen bemoosten Steinen findest du die Reste einer alten Ruine... <b>+'+g+' Münzen</b> lagen vergessen zwischen den Trümmern.',3200);
  }else if(kind==='hoehle'){
    toast('🕳️ Ein dunkler Höhleneingang öffnet sich im Fels. Ein kalter Luftzug weht heraus – vielleicht ein andermal.',3200);
  }else if(kind==='haendler'){
    addItem('bindungsstein',2);
    toast('🧳 Ein wandernder Händler kreuzt deinen Weg: "Nimm das, für unterwegs!" <b>+2 Bindungssteine</b>',3200);
  }else if(kind==='schatz'){
    const g=40+Math.floor(h2(x+13,y+1300+a)*100);
    state.money+=g;
    addItem('supertrank',1);
    toast('💰 Du entdeckst eine vergrabene Schatztruhe! <b>+'+g+' Münzen</b> und ein Supertrank.',3200);
  }else if(kind==='legendspur'){
    const txt=(LEGEND_CLUE_TEXT[a]&&LEGEND_CLUE_TEXT[a].spuren)||'👣 Riesige, unbekannte Fährten ziehen sich durch das Gelände...';
    grantLegendClue(a,'spuren',txt);
  }else if(kind==='legendlicht'){
    const txt=(LEGEND_CLUE_TEXT[a]&&LEGEND_CLUE_TEXT[a].licht)||'✨ Ein seltsames Leuchten erscheint kurz und verschwindet wieder.';
    grantLegendClue(a,'licht',txt);
  }
  saveGame(true);
}
// Legende in diesem Gebiet: fehlende Hinweisarten als zusätzliche Zufallsereignisse anbieten
function eventPoolFor(a){
  return EVENT_POOL.slice();
}
function checkRandomEvent(x,y){
  if(state.loc!=='route')return;
  if(!EVENT_TILES.has(tileAt(x,y)))return;
  state.events=state.events||[];
  const key='ev:'+state.area+':'+x+':'+y;
  if(state.events.indexOf(key)>=0)return;
  const r=h2(x*17+state.area*211+11,y*23+state.area*89+7);
  if(r<.965)return;   // ~3.5% der begehbaren Felder tragen ein Ereignis
  state.events.push(key);
  const r2=h2(x*29+state.area*53+3,y*31+state.area*97+5);
  const pool=eventPoolFor(state.area);
  const total=pool.reduce((s,e)=>s+e.w,0);
  let pick=r2*total,ev=pool[pool.length-1];
  for(const e of pool){if(pick<e.w){ev=e;break;}pick-=e.w;}
  runEvent(ev.kind,x,y);
}
// Fest platzierte Fundstücke in Nebenbereichen (keine Zufallschance, gezielt entdeckbar)
// Hinweis-Ereignisse für Legenden: schrittbasiert statt feldgebunden, damit sie nie
// durch unglücklichen Kartenzufall unmöglich zu finden sind (siehe checkRandomEvent).
function checkLegendClueEvent(x,y){
  if(state.loc!=='route')return;
  const a=state.area;
  if(!LEGEND_DATA[a])return;
  if(legendClueCount(a)>=LEGEND_CLUE_KINDS.length)return;
  if(!EVENT_TILES.has(tileAt(x,y)))return;
  const have=state.legendClues||[];
  const missing=['spuren','licht'].filter(k=>have.indexOf(a+':'+k)<0);
  if(!missing.length)return;
  state.legendCluePity=state.legendCluePity||{};
  const pity=(state.legendCluePity[a]||0)+1;
  const forced=pity>=25;   // spätestens nach 25 passenden Schritten wird der Hinweis erzwungen
  if(!forced&&Math.random()>.06){state.legendCluePity[a]=pity;return;}   // ~6% Chance pro Schritt
  state.legendCluePity[a]=0;
  const kind=missing[Math.floor(Math.random()*missing.length)];
  runEvent(kind==='spuren'?'legendspur':'legendlicht',x,y);
}
function checkSidePickup(x,y){
  if(state.loc!=='side')return;
  const sa=SIDE_AREAS[state.sideId];
  if(!sa||!sa.pickups)return;
  const pu=sa.pickups.find(p=>p.pos[0]===x&&p.pos[1]===y);
  if(!pu)return;
  const key='side:'+state.sideId+':'+x+':'+y;
  state.found=state.found||[];
  if(state.found.indexOf(key)>=0)return;
  if(pu.requireType&&!state.team.some(m=>mTypes(m).includes(pu.requireType))){
    toast(pu.lockedMsg||('🔒 Etwas ist hier verschlossen. Vielleicht braucht es ein bestimmtes Kryptid, um es zu öffnen.'),3200);
    return;
  }
  state.found.push(key);
  if(pu.item)addItem(pu.item,pu.qty||1);
  const bonus=pu.money?(state.money+=pu.money,' <b>+'+pu.money+' Münzen</b>'):'';
  const baseMsg=typeof pu.msg==='function'?pu.msg():pu.msg;
  toast((baseMsg||('✨ Du findest: <b>'+(pu.item?ITEMS[pu.item].name:'etwas Interessantes')+'</b>!'))+bonus,3400);
  saveGame(true);
}

let moveLock=false;
let arenaGateOpen=false; // Schalter/Tor-Rätsel: pro Hallenbesuch zurückgesetzt

// ---- Seltene sichtbare Kryptiden-Momente: kurze Sichtung, kein Kampf, nur Atmosphäre ----
let sighting=null; // {id,x,y,born,life}
const SIGHTING_FLAVORS=[
  'schaut kurz aus dem Gebüsch',
  'huscht über den Weg',
  'verschwindet blitzschnell im Dickicht',
  'beobachtet dich einen Moment lang aus der Ferne'
];
// Ein paar Arten verhalten sich sichtbar anders als der Rest
const SIGHTING_SPECIAL={
  flatterix:{flavor:'flattert unstet zwischen den Bäumen hin und her',life:1200},
  flatterax:{flavor:'zieht in einer schnellen Kurve über den Weg',life:1200},
  aquappi:{flavor:'springt kurz aus dem Wasser und taucht sofort wieder ab',life:1000},
  aquadon:{flavor:'durchbricht kurz die Wasseroberfläche',life:1000},
  spuki:{flavor:'verschwindet, kaum dass du hinschaust',life:650},
  spukrator:{flavor:'löst sich auf, sobald dein Blick es streift',life:650},
  brockel:{flavor:'liegt reglos da und schnarcht leise – vielleicht doch kein Fels',life:2200},
  frosti:{flavor:'lugt kurz zwischen den Schneewehen hervor',life:1400}
};
function maybeSpawnSighting(){
  if(sighting||state.loc!=='route')return;
  if(Math.random()>0.018)return;   // ~1.8% Chance pro Schritt
  const roster=AREAS[state.area].roster;
  if(!roster||!roster.length)return;
  for(let tries=0;tries<8;tries++){
    const ang=Math.random()*Math.PI*2,dist=2+Math.random()*2;
    const tx=Math.round(state.px+Math.cos(ang)*dist),ty=Math.round(state.py+Math.sin(ang)*dist);
    if(tx===state.px&&ty===state.py)continue;
    const t=tileAt(tx,ty);
    if(t!=='.'&&t!==','&&t!=='M'&&t!=='V')continue;
    const unseen=roster.filter(id=>state.seen.indexOf(id)<0);
    const pool=unseen.length?unseen:roster;
    const id=pool[Math.floor(Math.random()*pool.length)];
    const special=SIGHTING_SPECIAL[id];
    sighting={id,x:tx,y:ty,born:performance.now(),life:(special?special.life:1500)+Math.random()*700};
    if(state.seen.indexOf(id)<0){state.seen.push(id);saveGame(true);}
    const f=special?special.flavor:SIGHTING_FLAVORS[Math.floor(Math.random()*SIGHTING_FLAVORS.length)];
    toast('👀 Du siehst kurz, wie ein <b>'+DEX[id].name+'</b> '+f+'!',2400);
    break;
  }
}
function drawSighting(camX,camY){
  if(!sighting)return;
  const age=performance.now()-sighting.born;
  if(age>sighting.life){sighting=null;return;}
  const alpha=age<300?age/300:(age>sighting.life-400?Math.max(0,(sighting.life-age)/400):1);
  const sx=Math.round((sighting.x-camX)*TILE),sy=Math.round((sighting.y-camY)*TILE);
  if(sx<-TILE*2||sy<-TILE*2||sx>VW*TILE+TILE||sy>VH*TILE+TILE){sighting=null;return;}
  wctx.save();wctx.globalAlpha=alpha;
  const bob=Math.sin(wfx.t*3)*1.5;
  paintMon(wctx,sighting.id,sx-3,sy-3+bob,1.6,false,false);
  wctx.restore();
}
async function movePlayer(dx,dy){
  if(dx||dy)state.facing=[dx,dy];
  if(state.mode!=='world'||moveLock||dialogAktiv)return;
  const nx=state.px+dx,ny=state.py+dy;
  // Bewohner ansprechen
  const np=npcAt(nx,ny);
  if(np){
    try{ talkTo(np); }
    catch(e){
      dialogAktiv=false;moveLock=false;
      toast('⚠️ Fehler beim Ansprechen: '+(e.message||e),4000);
      console.error('talkTo Fehler:',e);
    }
    return;
  }
  const tr=trainerAt(nx,ny);
  if(tr&&!state.team.length){
    toast('🔬 Ohne Gefährten an deiner Seite geht es hier nicht weiter.',2400);
    return;
  }
  if(tr){
    // In der Halle der Reihe nach
    if(state.loc==='arena'){
      if(tr.istMeister||state.area===7&&tr.order===4){
        const noetig=state.area===7?4:arenaCount();
        const fertig=state.area===7
          ? AREAS[7].trainers.slice(0,4).every(t=>isDone(t.key))
          : arenaTrainers().every(t=>isDone(t.key));
        if(!fertig&&!isDone(tr.key)){
          toast('🔒 Erst müssen alle '+noetig+' Herausforderer besiegt sein.');return;
        }
      }else if(tr.order>0){
        const vor=state.area===7?ligaTrainers()[tr.order-1]:arenaTrainers()[tr.order-1];
        if(vor&&!isDone(vor.key)){
          toast('🔒 '+(vor.name||'Der vorige Gegner')+' ist noch nicht besiegt.');return;
        }
      }
    }
    if(!isDone(tr.key)){startTrainerBattle(tr);return;}
    if(tr.kind!=='boss'){startTrainerBattle(tr,true);return;}
    toast(tr.name+': "Ich brauche eine Pause – komm später wieder."');return;
  }
  const LG=activeLegend2();
  if(LG&&LG.pos[0]===nx&&LG.pos[1]===ny){startLegendBattle(LG);return;}
  const zt=tileAt(nx,ny);
  if(zt==='N'){nordAusgang();return;}
  if(zt==='S'){suedAusgang();return;}
  if(zt==='H'){openShop();return;}
  if(zt==='A'){
    arenaGateOpen=false;
    initArenaPuzzle(state.area);
    gotoLoc('arena',state.area,[10,15],'⚔️ '+ARENA_NAMES[state.area]+
      (state.area===7?' · fünf Meister ohne Pause':' · '+arenaCount()+' Herausforderer, dann der Meister'));
    return;
  }
  if(zt==='D'){
    if(state.loc==='side'){
      const sa=SIDE_AREAS[state.sideId],pa=sa.parentArea;
      state.sideId=null;
      gotoLoc(sa.parentLoc||'route',pa,sa.returnPos,'◀ Zurück '+(sa.parentLoc==='protown'?('in '+PROLOGUE_TOWN.name):'auf der Route'));
    }else{
      if(state.loc==='arena'&&state.area===7&&!isDone('7-4')){
        ['7-0','7-1','7-2','7-3','7-4'].forEach(k=>{
          const idx=state.defeated.indexOf(k);
          if(idx>=0)state.defeated.splice(idx,1);
        });
        toast('↩️ Ohne die Liga-Halle in einem Zug zu meistern, treten alle fünf wieder frisch an.',3400);
      }
      gotoLoc('stadt',state.area,[CITY_DEFS[state.area].doorA[0],CITY_DEFS[state.area].doorA[1]+1],'◀ '+CITY_NAMES[state.area]);
    }
    return;
  }
  if(zt==='C'){
    const sideId=SIDE_LINK[state.area+':'+nx+':'+ny];
    if(sideId){
      const sa=SIDE_AREAS[sideId];
      if(sa.unlockCheck&&!sa.unlockCheck()){
        toast(sa.lockedMsg||'🔒 Hier ist noch nicht der richtige Zeitpunkt.',3200);
        return;
      }
      state.sideId=sideId;
      gotoLoc('side',state.area,sa.spawn,'🌿 '+sa.name);
    }
    return;
  }
  if(state.loc==='arena'&&state.arenaPuzzle&&state.arenaPuzzle.kind==='sokoban'&&!arenaBossDone()){
    const bi=state.arenaPuzzle.blocks.findIndex(b=>b[0]===nx&&b[1]===ny);
    if(bi>=0){
      const bx=nx+dx,by=ny+dy;
      const tileFree=(()=>{const t=ARENA_DEFS[state.area].rows[by][bx];return t==='F'||t==='Z';})();
      const otherBlock=state.arenaPuzzle.blocks.some((b,i)=>i!==bi&&b[0]===bx&&b[1]===by);
      if(!tileFree||otherBlock)return;
      state.arenaPuzzle.blocks[bi]=[bx,by];
      checkSokobanSolved();
    }
  }
  if(state.loc==='arena'&&state.arenaPuzzle&&state.arenaPuzzle.kind==='illusion'){
    const t=tileAt(nx,ny);
    if((t==='E'||t==='J')&&!state.arenaPuzzle.revealed.has(nx+','+ny)){
      state.arenaPuzzle.revealed.add(nx+','+ny);
      toast(t==='E'?'✨ Ein Trugbild! Hier geht es weiter.':'🌫️ Trugbild – hier ist kein Durchkommen.',1800);
    }
  }
  if(isBlocked(nx,ny))return;
  moveLock=true;
  let fx=state.px,fy=state.py,tx=nx,ty=ny,ddx=dx,ddy=dy;
  // Rätsel-Rutschbahn: Eis (gleiche Richtung) und Windfelder (feste Richtung) verketten sich
  for(let guard=0;guard<40;guard++){
    wfx.anim={fx,fy,tx,ty,k:0};
    state.px=tx;state.py=ty;
    if(state.loc==='arena'&&state.arenaPuzzle&&state.arenaPuzzle.kind==='fog')revealFog(tx,ty);
    checkFind(tx,ty);
    checkRandomEvent(tx,ty);
    checkSidePickup(tx,ty);
    checkLegendClueEvent(tx,ty);
    await wait(110);
    const t=tileAt(tx,ty);
    if(t==='X'){
      arenaGateOpen=!arenaGateOpen;
      toast(arenaGateOpen?'🔵 Ein Tor öffnet sich irgendwo in der Halle...':'🔴 Das Tor schließt sich wieder.',2200);
    }
    let ndx=0,ndy=0;
    if(t==='I'){ndx=ddx;ndy=ddy;}
    else if(t==='^'){ndx=0;ndy=-1;}
    else if(t==='v'){ndx=0;ndy=1;}
    else if(t==='<'){ndx=-1;ndy=0;}
    else if(t==='>'){ndx=1;ndy=0;}
    else break;
    const nx2=tx+ndx,ny2=ty+ndy;
    if(isBlocked(nx2,ny2))break;
    fx=tx;fy=ty;tx=nx2;ty=ny2;ddx=ndx;ddy=ndy;
  }
  if(state.team.length&&state.loc==='route'&&tileAt(state.px,state.py)===','&&Math.random()<.2){startWildBattle();moveLock=false;return;}
  if(state.team.length&&state.loc==='side'&&SIDE_AREAS[state.sideId]&&SIDE_AREAS[state.sideId].roster&&tileAt(state.px,state.py)==='F'&&Math.random()<.15){startWildBattle();moveLock=false;return;}
  maybeSpawnSighting();
  moveLock=false;
  checkTideCatch();
}
const NPC_PALS=[
 {B:'#a86a4a',F:'#f0c9a0',K:'#2b1d16',R:'#7fa8d0',J:'#4a5a70'},
 {B:'#d0a03c',F:'#e3b184',K:'#2b1d16',R:'#c94f6d',J:'#5c5470'},
 {B:'#5a9a6a',F:'#f0c9a0',K:'#2b1d16',R:'#e8c93c',J:'#3e4a52'},
 {B:'#8a6ab0',F:'#e3b184',K:'#2b1d16',R:'#f0e0d0',J:'#4a4058'},
 {B:'#c05a5a',F:'#f0c9a0',K:'#2b1d16',R:'#6a8ab0',J:'#544a44'},
 {B:'#4a8ab0',F:'#e3b184',K:'#2b1d16',R:'#d0c0a0',J:'#3a4450'}
];
// Gespräch mit einem Bewohner
let dialogAktiv=false;
function talkTo(np){
  if(dialogAktiv)return;
  const key=np.key||(state.area+'-'+np.idx);
  if(np.battleTeam&&!isDone(key)){
    dialogAktiv=false;
    startTrainerBattle({key,name:np.n,kind:'story',team:np.battleTeam,pal:np.pal||BOSS_PAL,
      dbl:false,intro:np.battleIntro||(np.n+' fordert dich heraus!'),win:np.battleWin||(np.n+' erkennt deine Stärke an.')});
    return;
  }
  dialogAktiv=true;
  state.npcGifts=state.npcGifts||[];
  state.npcSeen=state.npcSeen||[];
  state.quests=state.quests||{};
  const wiederholung=state.npcSeen.indexOf(key)>=0;
  if(!wiederholung)state.npcSeen.push(key);
  const q=np.quest?QUESTS.find(x=>x.id===np.quest):null;
  let zeilen=np.t.slice();
  let fabianHandled=false;
  if(key==='fabian-intro'&&wiederholung&&state.team.length){
    zeilen=['Fabian: "Wie kommt ihr beide zurecht? Die Bindungswiese hat wohl ein gutes Gespür für dich gehabt."'];
    fabianHandled=true;
  }
  let questHandled=false;
  if(q){
    const st=state.quests[q.id];
    if(!st){
      zeilen=zeilen.concat([q.offer]);
      state.quests[q.id]='active';
      saveGame(true);
      questHandled=true;
    }else if(st==='active'){
      questHandled=true;
      if(q.check()){
        if(q.legendGate){
          state.quests[q.id]='guardian';
          zeilen=[q.guardianWait];
        }else{
          if(q.onComplete)q.onComplete();
          state.quests[q.id]='done';
          zeilen=[q.complete];
          grantQuestReward(q);
        }
      }else{
        zeilen=[q.remind];
      }
    }else if(st==='guardian'){
      questHandled=true;
      if(isDone('guardian-'+q.area)){
        state.quests[q.id]='done';
        zeilen=[q.complete];
        grantQuestReward(q);
      }else{
        zeilen=[q.guardianWait];
      }
    }
  }
  // Bei erneutem Besuch ohne offene Quest-Zeile: eigene Zeilen des NPCs bevorzugt,
  // Dorfgerüchte nur noch anteilig mischen – sonst klingen alle Bewohner gleich.
  if(wiederholung&&!questHandled&&!fabianHandled){
    const own=(np.chat||[]).slice();
    const shared=(CHAT_POOLS[state.area]||[]).slice();
    const rumor=LEGEND_RUMORS[state.area];
    const needClue=rumor&&LEGEND_DATA[state.area]&&legendClueCount(state.area)<LEGEND_CLUE_KINDS.length&&
      (state.legendClues||[]).indexOf(state.area+':geruecht')<0;
    if(needClue)shared.push(rumor);
    let line=null;
    if(own.length&&(Math.random()<.65||!shared.length)){
      line=own[Math.floor(Math.random()*own.length)];
    }else if(shared.length){
      line=shared[Math.floor(Math.random()*shared.length)];
    }else if(own.length){
      line=own[Math.floor(Math.random()*own.length)];
    }
    if(line){
      zeilen=[line];
      if(needClue&&line===rumor)grantLegendClue(state.area,'geruecht','📖 Ein neues Gerücht macht die Runde...');
    }
  }
  let geschenkText=null;
  if(np.gift&&state.npcGifts.indexOf(key)<0){
    state.npcGifts.push(key);
    addItem(np.gift,np.n2||1);
    const it=ITEMS[np.gift];
    geschenkText=`🎁 Du erhältst <b>${it.name}</b>${(np.n2||1)>1?' ×'+np.n2:''}!`;
    saveGame(true);
  }
  let i=0;
  const box=$('npcBox'),txt=$('npcText'),nam=$('npcName'),btn=$('npcNext');
  nam.textContent=np.n;
  function zeige(){
    if(i<zeilen.length){txt.innerHTML=zeilen[i];btn.textContent=(i===zeilen.length-1&&!geschenkText)?'Schließen':'Weiter ▶';}
    else{txt.innerHTML=geschenkText;btn.textContent='Schließen';}
    i++;
  }
  btn.onclick=()=>{
    if(i>zeilen.length||(i===zeilen.length&&!geschenkText)){
      box.classList.add('hidden');dialogAktiv=false;
      if(key==='fabian-intro'&&!state.team.length){
        const sa=SIDE_AREAS.bindungswiese;
        state.sideId='bindungswiese';
        gotoLoc('side',0,sa.spawn,'🌿 Fabian führt dich zur '+sa.name+'.');
      }
      if(np.bondStarter&&!state.team.length){
        const id=np.bondStarter;
        state.starter=id;state.team=[makeMonster(id,5)];state.box=[];state.leadIdx=0;
        state.bag={bindungsstein:5,trank:2};state.money=600;state.seen=[id];state.caught=[id];
        state.defeated=[];state.rivals=[];state.legends=[];state.found=[];state.scrolls=[];state.npcGifts=[];
        state.pendingLearn=[];state.pendingEvo=[];state._equip=null;state.champion=false;state.dexRewards=[];
        state.healed=false;
        saveGame(true);
        toast('✨ Die Bindung ist geschlossen. '+DEX[id].name+' tritt an deine Seite!',3200);
      }
      return;
    }
    zeige();
  };
  box.classList.remove('hidden');
  zeige();
}
// Ortswechsel
function gotoLoc(loc,area,pos,hinweis){
  state.loc=loc;state.area=area;
  state.px=pos[0];state.py=pos[1];
  state.healed=false;wfx.anim=null;sighting=null;
  dialogAktiv=false;moveLock=false;
  if(loc==='stadt'){
    state.citiesVisited=state.citiesVisited||[];
    if(state.citiesVisited.indexOf(area)<0)state.citiesVisited.push(area);
  }
  saveGame(true);enterWorld();
  if(hinweis)toast(hinweis,3200);
}

function nordAusgang(){
  if(state.loc==='protown'){
    if(!state.team.length){toast('🌿 Sprich zuerst mit Fabian oder such die Bindungswiese im Osten auf.',2800);return;}
    gotoLoc('proroute',0,[10,15],'🛤️ Der Weg nach Mooshain beginnt.');
    return;
  }
  if(state.loc==='proroute'){
    healAll();
    gotoLoc('stadt',0,SPAWN_SUED,'🏘️ '+CITY_NAMES[0]+' · Gebiet 1 (Limit Lv.'+AREA_DEFS[0].cap+')');
    return;
  }
  if(state.loc==='stadt'){
    gotoLoc('route',state.area,SPAWN_SUED,
      '🛤️ Route '+(state.area+1)+' – hier warten Trainer und freilebende Kryptiden.');
  }else if(state.loc==='route'){
    if(!arenaCleared(state.area)){
      toast('🔒 Der Weg zur nächsten Stadt ist gesperrt.<br>'+
        '<span style="opacity:.85">Bezwinge zuerst die '+ARENA_NAMES[state.area]+' in '+CITY_NAMES[state.area]+'.</span>',3600);
      return;
    }
    const loreGate=LORE_GATES[state.area];
    if(loreGate&&!(state.found||[]).includes(loreGate.foundKey)){
      toast('🔒 Der Weg zur nächsten Stadt ist gesperrt.<br>'+
        '<span style="opacity:.85">'+loreGate.msg+'</span>',3800);
      return;
    }
    if(state.area>=7){championEnding();return;}
    healAll();
    gotoLoc('stadt',state.area+1,SPAWN_SUED,
      '🏘️ '+CITY_NAMES[state.area+1]+' · Gebiet '+(state.area+2)+' (Limit Lv.'+AREA_DEFS[state.area+1].cap+')');
  }
}
function suedAusgang(){
  if(state.loc==='proroute'){
    gotoLoc('protown',0,[10,2],'◀ Zurück in '+PROLOGUE_TOWN.name);
    return;
  }
  if(state.loc==='stadt'){
    if(state.area<=0){
      gotoLoc('proroute',0,[10,2],'◀ Zurück auf dem Weg nach '+PROLOGUE_TOWN.name);
      return;
    }
    gotoLoc('route',state.area-1,SPAWN_NORD,'◀ Zurück auf Route '+state.area);
  }else if(state.loc==='route'){
    gotoLoc('stadt',state.area,SPAWN_NORD,'◀ Zurück in '+CITY_NAMES[state.area]);
  }
}
function championEnding(){
  state.champion=true;saveGame(true);showScreen('world');
  const W=VW*TILE,H=VH*TILE;
  wctx.fillStyle='#1a0f2e';wctx.fillRect(0,0,W,H);
  wctx.textAlign='center';
  wctx.fillStyle='#f0d240';wctx.font='bold 19px "Courier New",monospace';
  wctx.fillText('🏆 CHAMPION! 🏆',W/2,H/2-40);
  wctx.fillStyle='#fff';wctx.font='bold 11px "Courier New",monospace';
  wctx.fillText('Du hast die Liga der Meister besiegt!',W/2,H/2-12);
  wctx.fillText('Arten verbündet: '+state.caught.length+'/'+DEX_ORDER.length,W/2,H/2+8);
  wctx.fillText('Münzen: '+state.money,W/2,H/2+26);
  wctx.fillText('Danke fürs Spielen!',W/2,H/2+48);
  wctx.textAlign='left';
  toast('Du bist Champion! Fange weiter für den vollen Katalog. 🎉',4000);
}

// ============================ KAMPF-GRAFIK ============================
const bctx=$('battleCanvas').getContext('2d');
const BW=332,BH=196;
function statusIcon(m){return m.status?STATUS[m.status].icon:'';}

// abgerundetes Rechteck (ohne Abhängigkeit von ctx.roundRect)
function rr(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

// ---- Effekt-/Animationszustand ----
const fx={dispXp:0,lungeP:0,lungeE:0,
  flash:0,flashCol:'255,255,255',texts:[],t:0,raf:null,last:0};
// aktive Kryptiden im Kampf (1 oder 2 pro Seite)
function pActive(){const b=state.battle;
  return b.double?b.pSlots.map(i=>i==null?null:state.team[i]).filter(Boolean):[lead()].filter(Boolean);}
function eActive(){const b=state.battle;
  return b.double?b.eSlots.map(i=>i==null?null:b.enemyTeam[i]).filter(Boolean):[b.enemy()].filter(Boolean);}
function activesList(){const b=state.battle;if(!b)return [];return pActive().concat(eActive());}
const dispOf=m=>(m&&m._disp!=null)?m._disp:(m?m.hp:0);
const isEnemyMon=m=>{const b=state.battle;return b.double?b.enemyTeam.indexOf(m)>=0:m===b.enemy();};
function fxPos(m){
  const b=state.battle;
  if(b&&b.double){
    const ei=b.eSlots.indexOf(b.enemyTeam.indexOf(m));
    if(ei===0)return{x:226,y:48};
    if(ei===1)return{x:288,y:76};
    const pi=b.pSlots.indexOf(state.team.indexOf(m));
    if(pi===0)return{x:64,y:126};
    if(pi===1)return{x:128,y:152};
    return{x:166,y:98};
  }
  return isEnemyMon(m)?{x:250,y:58}:{x:104,y:126};
}
function fxReset(){
  activesList().forEach(m=>{m._disp=m.hp;m._shake=0;});
  const p=lead();fx.dispXp=p?p.xp:0;
  fx.texts.length=0;fx.lungeP=fx.lungeE=fx.flash=0;
}
function fxHit(target,dmg,mult){
  target._shake=7;
  if(isEnemyMon(target))fx.lungeP=1;else fx.lungeE=1;
  fx.flash=mult>1?.55:.3;
  fx.flashCol=mult>1?'255,214,110':'255,255,255';
  const p=fxPos(target);
  fx.texts.push({x:p.x,y:p.y,txt:'-'+dmg,
    col:mult>1?'#ffd24a':mult<1?'#c9c0d8':'#fff',life:1.15,size:mult>1?15:13});
}
function fxGain(target,amount,col){
  const p=fxPos(target);
  fx.texts.push({x:p.x,y:p.y,txt:'+'+amount,col:col||'#7fe0a0',life:1.1,size:13});
}
function fxTick(dt){
  fx.t+=dt;
  activesList().forEach(m=>{
    if(m._disp==null)m._disp=m.hp;
    const d=m.hp-m._disp;
    m._disp+=Math.abs(d)<.5?d:d*Math.min(1,dt*9);
    m._shake=Math.max(0,(m._shake||0)-dt*34);
  });
  const p=lead();
  if(p){const dx=p.xp-fx.dispXp;
    const spd=Math.max(dt*3.2,dt*(p.xpNext/1.7)/Math.max(1,Math.abs(dx)));
    fx.dispXp+=Math.abs(dx)<.6?dx:dx*Math.min(1,spd);}
  fx.lungeP=Math.max(0,fx.lungeP-dt*4.5);
  fx.lungeE=Math.max(0,fx.lungeE-dt*4.5);
  fx.flash=Math.max(0,fx.flash-dt*1.9);
  for(let i=fx.texts.length-1;i>=0;i--){
    const t=fx.texts[i];t.life-=dt;t.y-=dt*20;
    if(t.life<=0)fx.texts.splice(i,1);
  }
}
function battleLoop(ts){
  if(state.mode!=='battle'){fx.raf=null;return;}
  const dt=Math.min(.05,(ts-(fx.last||ts))/1000);fx.last=ts;
  fxTick(dt);drawBattle();
  fx.raf=requestAnimationFrame(battleLoop);
}
function startBattleLoop(){fx.last=0;if(!fx.raf)fx.raf=requestAnimationFrame(battleLoop);}
// wartet, bis die KP-Balken den echten Wert eingeholt haben
function hpSettled(){
  return new Promise(res=>{
    const t0=(typeof performance!=='undefined'?performance.now():Date.now());
    (function chk(){
      const now=(typeof performance!=='undefined'?performance.now():Date.now());
      const ok=activesList().every(m=>Math.abs(m.hp-dispOf(m))<1);
      if(ok||now-t0>1500)res();else requestAnimationFrame(chk);
    })();
  });
}

function xpSettled(){
  return new Promise(res=>{
    const t0=(typeof performance!=='undefined'?performance.now():Date.now());
    (function chk(){
      const p=lead();
      const now=(typeof performance!=='undefined'?performance.now():Date.now());
      if(!p||Math.abs(p.xp-fx.dispXp)<1||now-t0>1600)res();else requestAnimationFrame(chk);
    })();
  });
}
function drawBar(x,y,w,h,pct,col,bg){
  bctx.fillStyle=bg||'#2a2438';rr(bctx,x-1,y-1,w+2,h+2,(h+2)/2);bctx.fill();
  bctx.fillStyle='#ddd5c2';rr(bctx,x,y,w,h,h/2);bctx.fill();
  const fw=Math.max(0,Math.min(w,w*pct));
  if(fw>1){
    const g=bctx.createLinearGradient(x,y,x,y+h);
    g.addColorStop(0,shade(col,1.25));g.addColorStop(1,col);
    bctx.fillStyle=g;rr(bctx,x,y,fw,h,h/2);bctx.fill();
  }
}

function drawDouble(){
  const b=state.battle,S=areaDef().style;
  const g=bctx.createLinearGradient(0,0,0,BH);
  g.addColorStop(0,shade(S.sky1,1.05));g.addColorStop(.55,S.sky1);g.addColorStop(1,S.sky2);
  bctx.fillStyle=g;bctx.fillRect(0,0,BW,BH);
  bctx.fillStyle=shade(S.sky2,.88);
  bctx.beginPath();bctx.moveTo(0,118);
  for(let x=0;x<=BW;x+=28)bctx.lineTo(x,110+Math.sin(x*.021)*12);
  bctx.lineTo(BW,BH);bctx.lineTo(0,BH);bctx.closePath();bctx.fill();
  bctx.fillStyle=S.grass;bctx.fillRect(0,152,BW,BH-152);
  bctx.fillStyle=shade(S.grass,.9);
  for(let x=0;x<BW;x+=9)bctx.fillRect(x,164+((x/9|0)%2)*4,5,2);

  function plat(cx,cy,rx){
    bctx.fillStyle='rgba(20,14,30,.14)';
    bctx.beginPath();bctx.ellipse(cx,cy+2,rx,rx*.25,0,0,Math.PI*2);bctx.fill();
    const pg=bctx.createLinearGradient(cx,cy-rx*.25,cx,cy+rx*.25);
    pg.addColorStop(0,shade(S.grass,1.1));pg.addColorStop(1,shade(S.grass,.82));
    bctx.fillStyle=pg;bctx.beginPath();bctx.ellipse(cx,cy,rx,rx*.23,0,0,Math.PI*2);bctx.fill();
  }
  const EP=[[196,16],[256,44]], PP=[[34,102],[98,128]];
  const es=eActive(), ps=pActive();
  plat(226,80,38);plat(288,108,38);
  plat(64,166,42);plat(128,192,42);
  const luP=fx.lungeP*8, luE=fx.lungeE*8;
  b.eSlots.forEach((idx,k)=>{
    if(idx==null)return;const m=b.enemyTeam[idx];if(!m||(m.hp<=0&&dispOf(m)<=0))return;
    const sh=(m._shake||0)>0?(Math.random()-.5)*m._shake:0;
    const bob=Math.sin(fx.t*2.1+k)*1.4;
    paintMon(bctx,m.id,Math.round(EP[k][0]+sh-luE),Math.round(EP[k][1]+bob),5,false,m.shiny);
  });
  b.pSlots.forEach((idx,k)=>{
    if(idx==null)return;const m=state.team[idx];if(!m||(m.hp<=0&&dispOf(m)<=0))return;
    const sh=(m._shake||0)>0?(Math.random()-.5)*m._shake:0;
    const bob=Math.sin(fx.t*2.1+1.1+k)*1.6;
    paintMon(bctx,m.id,Math.round(PP[k][0]+sh+luP),Math.round(PP[k][1]+bob),5,true,m.shiny);
  });

  const sel=(state.battle.busy||state.battle.over)?null:selectorMon();
  function sbox(x,y,m,active){
    if(!m)return;
    bctx.fillStyle='rgba(20,14,30,.18)';rr(bctx,x+2,y+2,114,30,8);bctx.fill();
    bctx.fillStyle='rgba(255,255,255,.96)';rr(bctx,x,y,114,30,8);bctx.fill();
    bctx.strokeStyle=active?'#c94f6d':'#33304a';bctx.lineWidth=active?3:2;
    rr(bctx,x,y,114,30,8);bctx.stroke();
    bctx.textBaseline='top';bctx.fillStyle='#33304a';
    bctx.font='bold 10px "Courier New",monospace';
    bctx.fillText(mName(m).slice(0,11),x+5,y+4);
    bctx.font='bold 9px "Courier New",monospace';
    bctx.fillText('Lv'+m.level,x+88,y+4);
    bctx.fillStyle=TYPE_COLORS[mType(m)];
    bctx.beginPath();bctx.arc(x+82,y+8,3,0,Math.PI*2);bctx.fill();
    const pct=Math.max(0,dispOf(m)/m.maxHp);
    drawBar(x+5,y+17,104,5,pct,pct<=.2?'#d95b43':pct<=.5?'#e8b93c':'#5aa464');
    if(m.status){
      bctx.fillStyle=STATUS[m.status].color;rr(bctx,x+5,y+24,34,7,3);bctx.fill();
      bctx.fillStyle='#fff';bctx.font='bold 7px "Courier New",monospace';
      bctx.fillText(STATUS[m.status].name.slice(0,6),x+7,y+24.5);
    }
  }
  sbox(6,6,es[0],false);sbox(6,40,es[1],false);
  sbox(212,96,ps[0],ps[0]&&ps[0]===sel);
  sbox(212,130,ps[1],ps[1]&&ps[1]===sel);

  bctx.fillStyle='rgba(20,14,30,.5)';rr(bctx,6,74,74,14,6);bctx.fill();
  bctx.fillStyle='#fff';bctx.font='bold 10px "Courier New",monospace';bctx.textBaseline='top';
  bctx.fillText('DOPPEL '+b.enemyTeam.map(m=>m.hp>0?'●':'○').join(''),10,77);

  const WB=curWeather();
  if(WB){
    bctx.fillStyle='rgba(20,14,30,.45)';rr(bctx,BW-92,BH-22,84,16,7);bctx.fill();
    bctx.fillStyle='#fff';bctx.font='bold 9px "Courier New",monospace';
    bctx.fillText(WB.icon+' '+WB.name.slice(0,10),BW-87,BH-18);
  }
  fx.texts.forEach(t=>{
    bctx.globalAlpha=Math.max(0,Math.min(1,t.life));
    bctx.font='bold '+t.size+'px "Courier New",monospace';bctx.textBaseline='middle';
    bctx.lineWidth=3;bctx.strokeStyle='rgba(25,18,38,.85)';bctx.strokeText(t.txt,t.x,t.y);
    bctx.fillStyle=t.col;bctx.fillText(t.txt,t.x,t.y);bctx.globalAlpha=1;
  });
  if(fx.flash>0){bctx.fillStyle='rgba('+fx.flashCol+','+(fx.flash*.5)+')';bctx.fillRect(0,0,BW,BH);}
}
function drawBattle(){
  const b=state.battle;if(!b)return;
  if(b.double)return drawDouble();
  const S=areaDef().style;
  // --- Hintergrund mit Ebenen ---
  const g=bctx.createLinearGradient(0,0,0,BH);
  g.addColorStop(0,shade(S.sky1,1.05));g.addColorStop(.55,S.sky1);g.addColorStop(1,S.sky2);
  bctx.fillStyle=g;bctx.fillRect(0,0,BW,BH);
  // ferne Hügel
  bctx.fillStyle=shade(S.sky2,.88);
  bctx.beginPath();bctx.moveTo(0,120);
  for(let x=0;x<=BW;x+=28)bctx.lineTo(x,112+Math.sin(x*.021)*13);
  bctx.lineTo(BW,BH);bctx.lineTo(0,BH);bctx.closePath();bctx.fill();
  bctx.fillStyle=shade(S.grass,.94);
  bctx.beginPath();bctx.moveTo(0,142);
  for(let x=0;x<=BW;x+=22)bctx.lineTo(x,138+Math.cos(x*.03)*8);
  bctx.lineTo(BW,BH);bctx.lineTo(0,BH);bctx.closePath();bctx.fill();
  // Boden
  bctx.fillStyle=S.grass;bctx.fillRect(0,158,BW,BH-158);
  bctx.fillStyle=shade(S.grass,.9);
  for(let x=0;x<BW;x+=9)bctx.fillRect(x,168+((x/9|0)%2)*4,5,2);

  const e=b.enemy(),p=lead();
  // --- Plattformen ---
  function platform(cx,cy,rx){
    bctx.fillStyle='rgba(20,14,30,.15)';
    bctx.beginPath();bctx.ellipse(cx,cy+3,rx,rx*.26,0,0,Math.PI*2);bctx.fill();
    const pg=bctx.createLinearGradient(cx,cy-rx*.26,cx,cy+rx*.26);
    pg.addColorStop(0,shade(S.grass,1.1));pg.addColorStop(1,shade(S.grass,.82));
    bctx.fillStyle=pg;
    bctx.beginPath();bctx.ellipse(cx,cy,rx,rx*.24,0,0,Math.PI*2);bctx.fill();
  }
  platform(240,92,54);
  platform(90,172,62);

  // --- Sprites mit Wippen, Zittern und Ausfallschritt ---
  const bobE=Math.sin(fx.t*2.1)*1.6, bobP=Math.sin(fx.t*2.1+1.1)*1.8;
  const shE=(e._shake||0)>0?(Math.random()-.5)*e._shake:0;
  const shP=(p._shake||0)>0?(Math.random()-.5)*p._shake:0;
  const luP=fx.lungeP*10, luE=fx.lungeE*10;
  if(e.hp>0||dispOf(e)>0)paintMon(bctx,e.id,Math.round(240-36+shE-luE),Math.round(34+bobE),6,false,e.shiny);
  if(p.hp>0||dispOf(p)>0)paintMon(bctx,p.id,Math.round(90-36+shP+luP),Math.round(110+bobP),6,true,p.shiny);

  // --- Infoboxen ---
  function box(x,y,m,disp,showNums){
    const h=showNums?58:34;
    bctx.fillStyle='rgba(20,14,30,.18)';rr(bctx,x+2,y+3,146,h,9);bctx.fill();
    bctx.fillStyle='rgba(255,255,255,.96)';rr(bctx,x,y,146,h,9);bctx.fill();
    bctx.strokeStyle='#33304a';bctx.lineWidth=2;rr(bctx,x,y,146,h,9);bctx.stroke();
    bctx.textBaseline='top';
    bctx.fillStyle='#33304a';bctx.font='bold 11px "Courier New",monospace';
    bctx.fillText(mName(m).slice(0,12),x+7,y+6);
    bctx.font='bold 10px "Courier New",monospace';
    bctx.fillText('Lv'+m.level,x+112,y+6);
    // Typ-Punkt
    bctx.fillStyle=TYPE_COLORS[mType(m)];
    bctx.beginPath();bctx.arc(x+104,y+11,3.5,0,Math.PI*2);bctx.fill();
    const pct=Math.max(0,disp/m.maxHp);
    drawBar(x+7,y+21,132,6,pct,pct<=.2?'#d95b43':pct<=.5?'#e8b93c':'#5aa464');
    if(showNums){
      bctx.fillStyle='#33304a';bctx.font='bold 9px "Courier New",monospace';
      bctx.fillText(Math.max(0,Math.round(disp))+'/'+m.maxHp,x+96,y+30);
      // ---- Einsicht-Balken ----
      const xpShown=Math.max(0,Math.min(m.xpNext,fx.dispXp));
      const rest=Math.max(0,Math.ceil(m.xpNext-xpShown));
      bctx.fillStyle='#5a5470';bctx.font='bold 8px "Courier New",monospace';
      bctx.fillText('EI',x+7,y+40);
      drawBar(x+22,y+40,117,5,Math.min(1,xpShown/m.xpNext),'#4a9fd8');
      bctx.fillStyle='#33304a';bctx.font='bold 8px "Courier New",monospace';
      bctx.fillText(Math.round(xpShown)+'/'+m.xpNext,x+7,y+49);
      bctx.fillStyle=rest<=0?'#5aa464':'#7a7290';
      const restTxt=rest<=0?'Level-Up!':'noch '+rest+' bis Lv.'+(m.level+1);
      bctx.fillText(restTxt,x+139-bctx.measureText(restTxt).width,y+49);
    }
    if(m.status){
      const w=42;
      bctx.fillStyle=STATUS[m.status].color;rr(bctx,x+7,y+(showNums?29:24),w,9,4);bctx.fill();
      bctx.fillStyle='#fff';bctx.font='bold 8px "Courier New",monospace';
      bctx.fillText(STATUS[m.status].name.slice(0,7),x+10,y+(showNums?30:25));
    }
  }
  box(8,10,e,dispOf(e),false);
  box(178,108,p,dispOf(p),true);

  // Wetteranzeige
  const WB=curWeather();
  if(WB){
    bctx.fillStyle='rgba(20,14,30,.45)';rr(bctx,BW-92,10,84,16,7);bctx.fill();
    bctx.fillStyle='#fff';bctx.font='bold 9px "Courier New",monospace';bctx.textBaseline='top';
    bctx.fillText(WB.icon+' '+WB.name.slice(0,10),BW-87,14);
  }
  // Gegner-Teamanzeige
  if(b.kind!=='wild'){
    bctx.fillStyle='rgba(20,14,30,.5)';rr(bctx,8,56,66,15,7);bctx.fill();
    bctx.fillStyle='#fff';bctx.font='bold 11px "Courier New",monospace';
    bctx.fillText(b.enemyTeam.map(m=>m.hp>0?'●':'○').join(' '),13,59);
  }

  // --- Schadenszahlen ---
  fx.texts.forEach(t=>{
    bctx.globalAlpha=Math.max(0,Math.min(1,t.life));
    bctx.font='bold '+t.size+'px "Courier New",monospace';
    bctx.textBaseline='middle';
    bctx.lineWidth=3;bctx.strokeStyle='rgba(25,18,38,.85)';
    bctx.strokeText(t.txt,t.x,t.y);
    bctx.fillStyle=t.col;bctx.fillText(t.txt,t.x,t.y);
    bctx.globalAlpha=1;
  });

  // --- Trefferblitz ---
  if(fx.flash>0){
    bctx.fillStyle='rgba('+fx.flashCol+','+(fx.flash*.5)+')';
    bctx.fillRect(0,0,BW,BH);
  }
}

// ============================ KAMPF-LOGIK ============================
function stageMult(s){return s>=0?1+.5*s:1/(1+.5*Math.abs(s));}
function effAtk(m){return m.atk*stageMult(m.stAtk||0)*(m.status==='brand'?.7:1);}
function effDef(m){return m.def*stageMult(m.stDef||0);}
function effSpd(m){
  let v=m.spd*stageMult(m.stSpd||0)*(m.status==='laehmung'?.5:1);
  if(hasAbil(m,'flink'))v*=1.25;
  if(hasAbil(m,'sturmherz'))v*=1.35;
  if(hasAbil(m,'drachenmut'))v*=1.2;
  if(heldEffect(m)==='schnell')v*=1.25;
  return v;
}
function curWeather(){const w=areaDef().weather;return w?WEATHER[w]:null;}
function resetStages(m){
  m.stAtk=0;m.stDef=0;m.stSpd=0;
  m._robust=false;m._ewig=false;m._fokus=false;m._kraut=false;m._wasFull=(m.hp>=m.maxHp);
}

function teamLevel(){
  const alive=state.team.filter(m=>m.hp>0);
  const list=alive.length?alive:state.team;
  return Math.round(list.reduce((s,m)=>s+m.level,0)/Math.max(1,list.length));
}
// Wetter beeinflusst, welche Art wild erscheint (Regen -> mehr Wasser, Sonne -> mehr Feuer, ...)
function pickWildBase(A){
  const W=curWeather();
  if(W){
    const matching=A.roster.filter(id=>{
      const d=DEX[id];
      return d&&(d.type===W.up||d.type2===W.up);
    });
    if(matching.length&&Math.random()<.6)return matching[rnd(0,matching.length-1)];
  }
  return A.roster[rnd(0,A.roster.length-1)];
}
function startWildBattle(){
  const sideRoster=(state.loc==='side'&&SIDE_AREAS[state.sideId]&&SIDE_AREAS[state.sideId].roster);
  const A=sideRoster?{roster:sideRoster,cap:AREA_DEFS[state.area].cap}:areaDef();
  const base=pickWildBase(A);
  // orientiert sich am eigenen Team, gedeckelt durch das Gebietslimit
  const lvl=Math.max(2,Math.min(A.cap-1,teamLevel()+rnd(-2,1)));
  const shiny=Math.random()<.005;
  const mon=makeMonster(speciesForLevel(base,lvl),lvl,shiny);
  markSeen(mon.id);
  ensureLead();resetStages(lead());resetStages(mon);
  const shy=!shiny&&Math.random()<.2;
  state.battle={kind:'wild',shy:shy,rounds:0,enemyTeam:[mon],idx:0,over:false,busy:false,
    enemy(){return this.enemyTeam[this.idx];}};
  showScreen('battle');fxReset();startBattleLoop();
  const W=curWeather();
  setMsg((shiny?'✨ Ein SELTENES ':shy?'Ein scheues ':'Ein freilebendes ')+
    `<b>${mName(mon)}</b> (Lv.${mon.level}) erscheint!`+
    (shy?'<br>Es wirkt fluchtbereit – schnell handeln!':'')+
    (W?`<br>${W.icon} ${W.name} liegt über dem Gebiet.`:''));
  setActions('main');
}
function startLegendBattle(L){
  const mon=makeMonster(L.id,L.lvl,false);
  markSeen(mon.id);
  ensureLead();resetStages(lead());resetStages(mon);
  state.battle={kind:'wild',legend:L,enemyTeam:[mon],idx:0,over:false,busy:false,
    enemy(){return this.enemyTeam[this.idx];}};
  showScreen('battle');fxReset();startBattleLoop();
  setMsg(L.intro+`<br>(Lv.${mon.level} · ${L.title})`);
  setActions('main');
}
function startTrainerBattle(tr,rematch){
  ensureLead();resetStages(lead());
  const scale=rematch?Math.max(0,state.area*2):0;
  const team=tr.team.map(t=>{const L=t.lvl+scale;const mon=makeMonster(speciesForLevel(FAMILY_OF[t.id],L),L);resetStages(mon);markSeen(mon.id);return mon;});
  const fit=state.team.map((m,i)=>({m,i})).filter(x=>x.m.hp>0);
  const dbl=!!tr.dbl&&fit.length>=2&&team.length>=2;
  state.battle={kind:tr.kind,trainer:tr,rematch:!!rematch,enemyTeam:team,idx:0,over:false,busy:false,
    double:dbl,orders:[],
    pSlots:dbl?[fit[0].i,fit[1].i]:null,
    eSlots:dbl?[0,1]:null,
    enemy(){return this.enemyTeam[this.idx];}};
  if(dbl){state.leadIdx=fit[0].i;team.forEach(m=>resetStages(m));}
  showScreen('battle');fxReset();startBattleLoop();
  const W2=curWeather();
  if(dbl){
    setMsg((rematch?tr.name+': "Nochmal!"':tr.intro)+
      `<br>⚔️ <b>DOPPELKAMPF!</b> ${tr.name} schickt <b>${mName(team[0])}</b> und <b>${mName(team[1])}</b>!`+
      (W2?`<br>${W2.icon} ${W2.name}.`:''));
    setTimeout(()=>{if(state.battle&&!state.battle.over)startSelection();},1200);
  }else{
    setMsg((rematch?tr.name+': "Nochmal!"':tr.intro)+`<br>${tr.name} schickt <b>${mName(state.battle.enemy())}</b>!`+
      (W2?`<br>${W2.icon} ${W2.name}.`:''));
    setActions('main');
  }
}
function ensureLead(){if(!lead()||lead().hp<=0){const i=state.team.findIndex(m=>m.hp>0);if(i>=0)state.leadIdx=i;}}

function setActions(mode){
  $('actionMain').classList.toggle('hidden',mode!=='main');
  $('actionContinue').classList.toggle('hidden',mode!=='continue');
  $('actionSub').classList.toggle('hidden',mode!=='sub');
  if(mode==='main')renderActions();
}
function renderActions(){
  const b=state.battle;if(!b)return;
  const p=b.double?(selectorMon()||lead()):lead();
  const mv=mMoves(p);
  // Kampf-Knopf zeigt, wie viele Attacken noch AP haben
  const frei=mv.filter((m,i)=>apOf(p,i)>0).length;
  $('btnFight').innerHTML='⚔️ Rufen<span class="mv-sub">'+
    (b.double?mName(p)+' · ':'')+frei+' von '+mv.length+' Attacken bereit</span>';
  $('btnFight').style.background=TYPE_COLORS[mType(p)];
  $('btnFight').style.boxShadow='0 3px 0 rgba(0,0,0,.32)';
  // Drei Aktionen: Beutel · Team · Flucht (bzw. Auswahl zurück)
  const beutelLeer=Object.keys(state.bag).filter(k=>{
    const it=ITEMS[k];if(!it||state.bag[k]<=0)return false;
    if(it.kind==='held'||it.kind==='scroll'||it.kind==='relic')return false;
    if(it.kind==='ball')return !b.double&&b.kind==='wild';
    return true;
  }).length===0;
  $('btnBag').innerHTML='🎒 Beutel';
  $('btnBag').disabled=beutelLeer;
  $('btnCatch').innerHTML='👥 Gefährten';
  $('btnCatch').disabled=false;
  if(b.double){
    $('btnSwitch').classList.add('hidden');
    $('btnFlee').classList.remove('hidden');
    $('btnFlee').className='secondary';
    $('btnFlee').innerHTML='↩ Auswahl zurück';
    $('btnFlee').disabled=!(b.orders&&b.orders.length);
  }else{
    $('btnFlee').classList.add('hidden');
    $('btnSwitch').classList.remove('hidden');
    $('btnSwitch').className='secondary';
    $('btnSwitch').innerHTML='💨 Rückzug';
    $('btnSwitch').disabled=b.kind!=='wild';
  }
}
// Eigene Kryptiden im Kampf ansehen – alle durchblätterbar
function infoZeile(label,wert,zusatz){
  return `<tr><td style="opacity:.65;padding-right:8px">${label}</td>`+
         `<td><b>${wert}</b>${zusatz?` <span style="opacity:.7">${zusatz}</span>`:''}</td></tr>`;
}
function showSelfInfo(idx){
  const b=state.battle;if(!b)return;
  const aktiv=b.double?selectorMon():lead();
  if(idx==null){idx=state.team.indexOf(aktiv);if(idx<0)idx=0;}
  const m=state.team[idx];if(!m)return;

  const ab=abilOf(m);
  const stg=v=>v>0?`+${v}`:`${v}`;
  const mod=[];
  if(m.stAtk)mod.push('ANG '+stg(m.stAtk));
  if(m.stDef)mod.push('VER '+stg(m.stDef));
  if(m.stSpd)mod.push('INI '+stg(m.stSpd));
  const pct=Math.max(0,m.hp/m.maxHp);
  const col=pct<=.2?'#d95b43':pct<=.5?'#e8b93c':'#5aa464';

  const attacken=mMoves(m).map((mo,i)=>{
    const ap=apOf(m,i),apMax=maxAPof(m,i);
    const leer=ap<=0;
    return `<div style="display:flex;align-items:center;gap:5px;margin-top:3px;${leer?'opacity:.45':''}">
      <span class="badge" style="background:${TYPE_COLORS[mo.type]};min-width:74px;text-align:center">${mo.name}</span>
      <span style="font-size:10px;opacity:.8;flex:1">${mo.power?'St. '+mo.power:'Effekt'} · ${moveAcc(mo)}% · AP ${ap}/${apMax}</span>
    </div>`;
  }).join('');

  setMsg(
    `<div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap">
       <b style="font-size:13px">${mName(m)}</b> ${typeBadges(m)}
       <span style="opacity:.75">Lv.${m.level}</span>
       ${m===aktiv?'<span class="badge" style="background:#c94f6d">im Einsatz</span>':''}
       ${m.hp<=0?'<span class="badge" style="background:#8a8298">erschöpft</span>':''}
       ${m.status?`<span class="badge" style="background:${STATUS[m.status].color}">${STATUS[m.status].icon} ${STATUS[m.status].name}</span>`:''}
     </div>
     <div class="hp-bar" style="max-width:none;margin-top:4px"><div style="height:100%;width:${pct*100}%;background:${col}"></div></div>
     <div style="font-size:10.5px;opacity:.8">${Math.max(0,m.hp)}/${m.maxHp} KP</div>
     <table style="font-size:10.5px;margin-top:4px;line-height:1.5">
       ${infoZeile('Angriff',Math.round(effAtk(m)),m.stAtk?'(Basis '+m.atk+')':'')}
       ${infoZeile('Verteidigung',Math.round(effDef(m)),m.stDef?'(Basis '+m.def+')':'')}
       ${infoZeile('Initiative',Math.round(effSpd(m)),m.stSpd||m.status==='laehmung'?'(Basis '+m.spd+')':'')}
     </table>
     <div style="font-size:10.5px;margin-top:4px;line-height:1.5">
       ${ab?`<b>${ABILITIES[ab].name}</b> <span style="opacity:.75">– ${ABILITIES[ab].desc}</span><br>`:''}
       ${m.held&&ITEMS[m.held]?`🎽 <b>${ITEMS[m.held].name}</b> <span style="opacity:.75">– ${ITEMS[m.held].desc}</span><br>`:''}
       ${mod.length?`<span style="color:#c94f6d"><b>Veränderungen: ${mod.join(' · ')}</b></span>`:'<span style="opacity:.6">Keine Werteveränderungen</span>'}
     </div>
     ${attacken}`);

  // Auswahl: ein Knopf je Teammitglied
  const g=$('actionSub');g.innerHTML='';
  const backBtn=document.createElement('button');backBtn.className='secondary span2 sticky-top';backBtn.textContent='◀ Zurück zum Kampf';
  backBtn.onclick=()=>{setActions('main');if(b.double)promptNext();};
  g.appendChild(backBtn);
  state.team.forEach((mm,i)=>{
    const btn=document.createElement('button');
    const p2=Math.max(0,mm.hp/mm.maxHp);
    btn.innerHTML=mName(mm)+'<span class="mv-sub">Lv'+mm.level+' · '+Math.max(0,mm.hp)+'/'+mm.maxHp+' KP '+statusIcon(mm)+'</span>';
    if(i===idx){btn.style.background=TYPE_COLORS[mType(mm)];btn.style.boxShadow='0 3px 0 rgba(0,0,0,.35)';}
    else{btn.className='secondary';}
    if(mm.hp<=0)btn.style.opacity='.55';
    btn.onclick=()=>showSelfInfo(i);
    g.appendChild(btn);
  });
  // Einwechseln, wenn sinnvoll
  const aktivListe=b.double?b.pSlots.map(k=>state.team[k]):[lead()];
  const istAktiv=aktivListe.indexOf(m)>=0;
  if(!istAktiv&&m.hp>0){
    const w=document.createElement('button');
    w.className='span2';
    w.style.background=TYPE_COLORS[mType(m)];
    w.innerHTML='🔄 '+mName(m)+' einwechseln<span class="mv-sub">kostet diesen Zug</span>';
    w.onclick=()=>{
      if(b.double){
        const slot=b.pSlots.indexOf(state.team.indexOf(selectorMon()));
        if(slot<0)return;
        b.pSlots[slot]=idx;resetStages(m);m._disp=m.hp;
        b.orders.push({m,move:null,target:null});
        setMsg(`Los, <b>${mName(m)}</b>!`);
        setTimeout(promptNext,600);
      }else{
        state.leadIdx=idx;resetStages(m);fx.dispP=m.hp;fx.dispXp=m.xp;
        doRound({type:'switch',run:async()=>{
          setMsg(`Los, <b>${mName(m)}</b>!`);await readPause();return true;}});
      }
    };
    g.appendChild(w);
  }else if(istAktiv){
    const hin=document.createElement('button');
    hin.className='secondary span2';hin.disabled=true;
    hin.innerHTML='steht schon im Einsatz';
    g.appendChild(hin);
  }else{
    const hin=document.createElement('button');
    hin.className='secondary span2';hin.disabled=true;
    hin.innerHTML='erschöpft – braucht erst Ruhe';
    g.appendChild(hin);
  }
  setActions('sub');
}
function continueTo(fn){
  setActions('continue');$('btnContinue').disabled=false;
  $('btnContinue').onclick=async()=>{
    if(state.pendingEvo&&state.pendingEvo.length){
      lockActions();
      await playEvolutions();
    }
    fn();
  };
}
// Entwicklungen nach dem Kampf: längere Animation, in Ruhe
async function playEvolutions(){
  const liste=state.pendingEvo.slice();state.pendingEvo=[];
  for(const p of liste){
    while(canEvolve(p)){
      const old=mName(p);
      setMsg(`Nanu...? <b>${old}</b> beginnt zu leuchten!`);
      // langsam anschwellendes Leuchten
      for(let i=0;i<10;i++){
        fx.flash=Math.min(1,.25+i*.09);fx.flashCol='255,255,255';
        fx.shakeP=3+i*.7;
        await wait(230);
      }
      p.id=DEX[p.id].evo;refreshStats(p);markCaught(p.id);
      p.ap=apFor(p.moves);
      for(let i=0;i<3;i++){fx.flash=1;fx.flashCol='255,255,255';await wait(180);}
      fx.texts.push({x:104,y:118,txt:'★',col:'#f0d240',life:1.6,size:22});
      setMsg(`🎉 <b>${old}</b> hat sich zu <b>${mName(p)}</b> entwickelt!<br>`+
        `<span style="opacity:.85">KP ${p.maxHp} · ANG ${p.atk} · VER ${p.def} · INI ${p.spd}</span>`);
      await readPause(900);
    }
  }
}
function lockActions(){setActions('continue');$('btnContinue').disabled=true;}

function calcDamage(att,move,def){
  const mult=multVs(move.type,mTypes(def));
  const eff=softMult(mult);
  const stab=mTypes(att).indexOf(move.type)>=0?1.5:1;
  const crit=Math.random()<.0625?1.8:1;
  let bonus=1;
  const W=curWeather();
  if(W){if(W.up===move.type)bonus*=1.2;if(W.down===move.type)bonus*=.8;}
  if(hasAbil(att,'hitzkopf')&&att.hp<att.maxHp*.3)bonus*=1.4;
  if(hasAbil(att,'kampfgeist')&&att.hp<att.maxHp*.5)bonus*=1.25;
  if(heldEffect(att)==='macht')bonus*=1.15;
  if(hasAbil(def,'eisschild')||hasAbil(def,'panzerhaut'))bonus*=.8;
  if(heldEffect(def)==='schutz')bonus*=.85;
  const raw=((2*att.level/5+2)*move.power*effAtk(att)/Math.max(1,effDef(def)))/16+2;
  const dmg=Math.max(1,Math.floor(raw*eff*stab*crit*bonus*(.87+Math.random()*.13)));
  return{dmg,mult,crit:crit>1};
}
// Statusprobleme: Felsenfest blockt alles
function canStatus(m){return !m.status&&!hasAbil(m,'felsenfest');}
// Tödlichen Treffer überstehen?
function surviveHit(m){
  if(m.hp>0)return null;
  if(hasAbil(m,'robust')&&!m._robust&&m._wasFull){m._robust=true;m.hp=1;return ABILITIES.robust.name;}
  if(hasAbil(m,'ewigkeit')&&!m._ewig){m._ewig=true;m.hp=Math.floor(m.maxHp*.15);return ABILITIES.ewigkeit.name;}
  if(heldEffect(m)==='fokus'&&!m._fokus&&m._wasFull){m._fokus=true;m.hp=1;return ITEMS.fokusgurt.name;}
  return null;
}
const effTxt=m=>m>1?' Sehr effektiv!':m<1?' Nicht sehr effektiv...':'';

const VERZWEIFLER={name:'Verzweifler',type:'Normal',power:12,kind:'dmg',acc:100};
async function applyMove(att,def,move,attIsPlayer,slot){
  const an=mName(att);
  // AP abziehen
  if(slot!=null&&att.ap&&att.ap[slot]!=null){
    if(att.ap[slot]<=0){move=VERZWEIFLER;}
    else att.ap[slot]--;
  }
  // Frost/Lähmung: Zug verlieren?
  if(att.status==='frost'){
    if(Math.random()<.3){setMsg(`<b>${an}</b> ist eingefroren und kann sich nicht bewegen!`);await readPause();return{skipped:true};}
    if(Math.random()<.35){att.status=null;setMsg(`<b>${an}</b> ist aufgetaut!`);await readPause();}
  }
  if(att.status==='laehmung'&&Math.random()<.25){
    setMsg(`<b>${an}</b> ist gelähmt und kann nicht angreifen!`);await readPause();return{skipped:true};
  }
  if(move.power>0&&hasAbil(def,'schwebe')&&Math.random()<.25){
    setMsg(`<b>${an}</b> setzt <b>${move.name}</b> ein – <b>${mName(def)}</b> schwebt beiseite und weicht aus!`);
    await readPause();return{};
  }
  // Genauigkeit
  const treffer=Math.random()*100<moveAcc(move)*(att.status==='frost'?.9:1);
  if(!treffer&&move.kind!=='buff'&&move.kind!=='heal'){
    setMsg(`<b>${an}</b> setzt <b>${move.name}</b> ein – daneben!`);
    await readPause();return{};
  }
  let txt=`<b>${an}</b> setzt <b>${move.name}</b> ein!`;
  if(move.kind==='buff'){
    const key=move.stat==='atk'?'stAtk':move.stat==='def'?'stDef':'stSpd';
    const lbl=move.stat==='atk'?'Angriff':move.stat==='def'?'Verteidigung':'Initiative';
    att[key]=Math.min(3,(att[key]||0)+move.stages);
    txt+=`<br>${lbl} steigt!`;
    setMsg(txt);drawBattle();await readPause();return{};
  }
  if(move.kind==='heal'){
    const h=Math.min(att.maxHp-att.hp,Math.floor(att.maxHp*move.heal));
    att.hp+=h;fxGain(att,h);
    txt+=`<br>${an} erholt sich um ${h} KP!`;
    setMsg(txt);await hpSettled();await readPause();return{};
  }
  if(move.kind==='debuff'){
    const key=move.stat==='atk'?'stAtk':'stDef';
    def[key]=Math.max(-3,(def[key]||0)-move.stages);
    txt+=`<br>${mName(def)}s ${move.stat==='atk'?'Angriff':'Verteidigung'} sinkt!`;
    setMsg(txt);drawBattle();await readPause();return{};
  }
  if(move.kind==='status'){
    if(!canStatus(def)){txt+=hasAbil(def,'felsenfest')
      ?`<br>${mName(def)} ist felsenfest – kein Effekt!`:`<br>Es zeigt keine Wirkung.`;}
    else if(Math.random()<move.chance){def.status=move.status;def.statusTurns=0;
      txt+=`<br>${mName(def)} erleidet ${STATUS[move.status].name}! ${STATUS[move.status].icon}`;}
    else txt+='<br>Es hat nicht gewirkt!';
    setMsg(txt);drawBattle();await readPause();return{};
  }
  // Schadensattacke
  const{dmg,mult,crit}=calcDamage(att,move,def);
  def._wasFull=(def.hp>=def.maxHp);
  def.hp-=dmg;
  fxHit(def,dmg,crit?3:mult);
  if(crit)txt+=' <b>Volltreffer!</b>';
  txt+=effTxt(mult);
  if(move.drain){const h=Math.floor(dmg*move.drain);att.hp=Math.min(att.maxHp,att.hp+h);
    fxGain(att,h);txt+=`<br>${an} saugt ${h} KP ab!`;}
  if(move.status&&canStatus(def)&&Math.random()<move.chance){
    def.status=move.status;def.statusTurns=0;
    txt+=`<br>${mName(def)} erleidet ${STATUS[move.status].name}! ${STATUS[move.status].icon}`;
  }
  // Fähigkeiten des Getroffenen
  if(hasAbil(def,'dornenpanzer')&&def.hp>0){
    const back=Math.max(1,Math.floor(dmg*.12));att.hp-=back;
    fxHit(att,back,1);txt+=`<br>Dornenpanzer verletzt ${an} um ${back} KP!`;
  }
  if(hasAbil(def,'statik')&&canStatus(att)&&Math.random()<.3){
    att.status='laehmung';txt+=`<br>Statik lähmt ${an}! ⚡`;
  }
  if(hasAbil(def,'giftdorn')&&canStatus(att)&&Math.random()<.28){
    att.status='gift';txt+=`<br>Giftdorn vergiftet ${an}! ☠️`;
  }
  if(hasAbil(att,'seelenraub')){
    const h=Math.min(att.maxHp-att.hp,Math.floor(dmg*.2));
    if(h>0){att.hp+=h;fxGain(att,h);txt+=`<br>Seelenraub heilt ${an} um ${h} KP!`;}
  }
  // Tödlichen Treffer überstehen
  const saved=surviveHit(def);
  if(saved)txt+=`<br>💫 <b>${mName(def)}</b> hält durch – ${saved}!`;
  const savedAtt=surviveHit(att);
  if(savedAtt)txt+=`<br>💫 <b>${an}</b> hält durch – ${savedAtt}!`;
  if(move.debuff){const key=move.debuff==='spd'?'stSpd':move.debuff==='atk'?'stAtk':'stDef';
    def[key]=Math.max(-3,(def[key]||0)-(move.stages||1));
    const lbl=move.debuff==='spd'?'wird langsamer':move.debuff==='atk'?'greift schwächer an':'verteidigt schwächer';
    txt+=`<br>${mName(def)} ${lbl}!`;}
  setMsg(txt);await hpSettled();await readPause();
  if(move.switchAfter&&attIsPlayer&&att.hp>0)return{switchAfter:true};
  return{};
}

async function bossMayHeal(e){
  const b=state.battle;
  if(!b.trainer||b.trainer.kind!=='boss'||b.bossHealed)return false;
  if(!e||e.hp<=0||e.hp>e.maxHp*.3)return false;
  b.bossHealed=true;
  const h=Math.min(e.maxHp-e.hp,Math.floor(e.maxHp*.45));
  if(h<=0)return false;
  e.hp+=h;fxGain(e,h,'#8fe0a0');
  setMsg(`${b.trainer.name}: "Noch lange nicht!"<br><b>${mName(e)}</b> wird um ${h} KP geheilt!`);
  await hpSettled();await readPause();
  return true;
}
function aiChooseIdx(e,p){
  const mv=mMoves(e);let best=0,bs=-1;
  mv.forEach((m,i)=>{
    if(e.ap&&e.ap[i]<=0)return;           // keine AP mehr
    let sc;
    if(m.kind==='dmg'){const{dmg}=calcDamage(e,m,p);sc=dmg*(m.drain?1.15:1);}
    else if(m.kind==='status'){sc=p.status?0:effDef(p)*.55;}
    else if(m.kind==='heal'){sc=e.hp<e.maxHp*.28?e.maxHp*.3:0;}
    else if(m.kind==='buff'){sc=(e.stAtk||0)<2&&e.hp>e.maxHp*.5?effAtk(e)*.4:0;}
    else if(m.kind==='debuff'){sc=(p.stAtk||0)>-2?effAtk(p)*.35:0;}
    else sc=0;
    sc*=moveAcc(m)/100;
    if(sc>bs){bs=sc;best=i;}
  });
  return best;
}
function aiChoose(e,p){
  const mv=mMoves(e);let best=mv[0],bs=-1;
  mv.forEach(m=>{
    let sc;
    if(m.kind==='dmg'){
      const{dmg}=calcDamage(e,m,p);sc=dmg*(m.drain?1.15:1);
    }else if(m.kind==='status'){sc=p.status?0:effDef(p)*.55;}
    else if(m.kind==='heal'){sc=e.hp<e.maxHp*.4?e.maxHp*.45:0;}
    else if(m.kind==='buff'){sc=(e.stAtk||0)<2&&e.hp>e.maxHp*.5?effAtk(e)*.4:0;}
    else if(m.kind==='debuff'){sc=(p.stAtk||0)>-2?effAtk(p)*.35:0;}
    else sc=0;
    if(sc>bs){bs=sc;best=m;}
  });
  return best;
}

// Statusschaden – greift auch dann, wenn der Vergiftete den Gegner besiegt
async function statusTick(list){
  for(const m of list){
    if(!m||m.hp<=0||!m.status)continue;
    if(m.status==='brand'||m.status==='gift'){
      const d=Math.max(1,Math.floor(m.maxHp/(m.status==='brand'?8:7)));
      m.hp-=d;
      const fp=fxPos(m);
      fx.texts.push({x:fp.x,y:fp.y,txt:'-'+d,col:STATUS[m.status].color,life:1.1,size:12});
      setMsg(`<b>${mName(m)}</b> leidet unter ${STATUS[m.status].name}! (-${d} KP)`);
      await hpSettled();await readPause();
    }
  }
}
async function endOfTurn(){
  const b=state.battle;
  // Regeneration durch Fähigkeit oder Tragitem
  for(const m of activesList()){
    if(!m||m.hp<=0)continue;
    let pct=0;
    if(hasAbil(m,'regenerator'))pct+=.06;
    if(hasAbil(m,'lebenskraft'))pct+=.09;
    if(heldEffect(m)==='regen')pct+=.07;
    if(pct>0&&m.hp<m.maxHp){
      const h=Math.min(m.maxHp-m.hp,Math.max(1,Math.floor(m.maxHp*pct)));
      m.hp+=h;fxGain(m,h);
      setMsg(`<b>${mName(m)}</b> erholt sich um ${h} KP.`);
      await hpSettled();await readPause();
    }
    // Heilkraut greift einmal bei wenig KP
    if(heldEffect(m)==='heilkraut'&&!m._kraut&&m.hp<m.maxHp*.25){
      m._kraut=true;
      const h=Math.min(m.maxHp-m.hp,Math.floor(m.maxHp*.4));
      m.hp+=h;fxGain(m,h,'#8fe0a0');
      setMsg(`🌿 <b>${mName(m)}</b> verbraucht sein Heilkraut! +${h} KP`);
      await hpSettled();await readPause();
    }
  }
  await statusTick(activesList());
}

async function doRound(action){
  const b=state.battle;if(!b||b.busy||b.over)return;
  b.busy=true;lockActions();
  const p=lead(),e=b.enemy();

  // Nicht-Angriffs-Aktionen zuerst
  if(action.type!=='move'){
    const cont=await action.run();
    if(b.over){b.busy=false;return;}
    if(!cont){b.busy=false;setActions('main');return;}
    if(lead().hp>0&&b.enemy().hp>0){
      const healed=await bossMayHeal(b.enemy());
      if(!healed){
        const e2=b.enemy(),ei=aiChooseIdx(e2,lead());
        await applyMove(e2,lead(),mMoves(e2)[ei]||VERZWEIFLER,false,ei);
        if(lead().hp<=0)return playerFaint();
      }
    }
    await endOfTurn();
    if(b.enemy().hp<=0)return enemyFaint();
    if(lead().hp<=0)return playerFaint();
    b.busy=false;setActions('main');return;
  }

  // Attacke: Reihenfolge nach Initiative
  const move=mMoves(p)[action.idx];
  const slot=action.idx;
  const playerFirst=effSpd(p)>=effSpd(e);
  const seq=playerFirst?[['p',move,slot],['e',null,null]]:[['e',null,null],['p',move,slot]];
  let switchOffer=false;
  for(const step of seq){
    if(b.over)return;
    if(step[0]==='p'){
      if(lead().hp<=0)continue;
      const r=await applyMove(lead(),b.enemy(),step[1],true,step[2]);
      if(r&&r.switchAfter)switchOffer=true;
      if(b.enemy().hp<=0)return enemyFaint();
    }else{
      if(b.enemy().hp<=0)continue;
      const healed=await bossMayHeal(b.enemy());
      if(!healed){
        const e2=b.enemy(),ei=aiChooseIdx(e2,lead());
        await applyMove(e2,lead(),mMoves(e2)[ei]||VERZWEIFLER,false,ei);
        if(lead().hp<=0)return playerFaint();
      }
    }
  }
  await endOfTurn();
  if(b.enemy().hp<=0)return enemyFaint();
  if(lead().hp<=0)return playerFaint();
  b.rounds=(b.rounds||0)+1;
  if(b.shy&&b.rounds>=2&&!b.over){
    b.over=true;
    setMsg(`Das scheue <b>${mName(b.enemy())}</b> ergreift die Flucht!`);
    await wait(1000);continueTo(enterWorld);return;
  }
  b.busy=false;
  if(switchOffer&&!b.double&&state.team.some((m,i)=>m.hp>0&&i!==state.leadIdx)){
    setMsg('Los, wer soll übernehmen?');
    showSwitch(true);return;
  }
  setActions('main');
}

async function enemyFaint(){
  const b=state.battle;
  // Statusschaden des eigenen Kämpfers wird noch abgerechnet
  await statusTick([lead()]);
  const e=b.enemy(),p=lead();
  const xp=Math.floor(e.level*22*(b.kind==='wild'?1:1.4));
  setMsg(`<b>${mName(e)}</b> wurde besiegt!<br>+${xp} Einsicht für ${mName(p)}`);
  drawBattle();await readPause();
  await grantXp(p,xp);
  const sh=shareXp(xp,p);
  if(state.team.length>1){
    setMsg(`Die restlichen Gefährten erhalten je ${Math.max(1,Math.floor(xp*.5))} Einsicht.`+
      (sh.grown.length?`<br>⬆️ ${sh.grown.join(' · ')}`:'')+
      (sh.gelernt.length?`<br>✨ ${sh.gelernt.join(' · ')}`:'')+
      (sh.offen?`<br>📘 ${sh.offen}× neue Attacke wartet im Menü`:''));
    await readPause();
  }
  if(b.kind!=='wild'&&b.idx<b.enemyTeam.length-1){
    b.idx++;resetStages(b.enemy());b.enemy()._disp=b.enemy().hp;
    setMsg(`${b.trainer.name} schickt <b>${mName(b.enemy())}</b>!`);
    await readPause();b.busy=false;setActions('main');return;
  }
  b.over=true;
  if(b.kind!=='wild'){
    trainerWinRewards();
  }else if(b.legend){
    const money=Math.floor(e.level*30);
    state.money+=money;
    setMsg(`Du hast <b>${mName(e)}</b> bezwungen! 💰 +${money} Münzen.`+grantLegendScroll()+`<br>`+
      `Es zieht sich zurück – du kannst es später erneut herausfordern und fangen.`);
  }else{
    const money=Math.floor(e.level*8);
    state.money+=money;
    setMsg(`Sieg! 💰 +${money} Münzen.`);
  }
  saveGame(true);continueTo(enterWorld);
}

// Welche Schriftrolle ein Boss hinterlässt
const BOSS_SCROLL={0:'r_pflanze',1:'r_geist',2:'r_wasser',3:'r_kampf',
  4:'r_feuer',5:'r_metall',6:'r_stein'};
const LEAGUE_SCROLL={2:'r_eis',4:'r_all'};
// Legendäre hinterlassen die übrigen Rollen
const LEGEND_SCROLL={1:'r_flug',3:'r_elektro',5:'r_gift',7:'r_drache'};
function grantLegendScroll(){
  const k=LEGEND_SCROLL[state.area];
  if(!k)return '';
  const tag='legendscroll-'+state.area;
  if((state.scrolls||[]).includes(tag))return '';
  state.scrolls=state.scrolls||[];state.scrolls.push(tag);
  addItem(k,1);
  return `<br>📜 Es hinterlässt die <b>${ITEMS[k].name}</b>!`;
}
function scrollForTrainer(tr){
  if(tr.kind!=='boss')return null;
  if(state.area<7)return BOSS_SCROLL[state.area]||null;
  const i=parseInt(tr.key.split('-')[1],10);
  return LEAGUE_SCROLL[i]||null;
}
function trainerWinRewards(){
  const b=state.battle,tr=b.trainer;
  const money=Math.floor(tr.lvl*(tr.kind==='boss'?95:tr.kind==='rival'?120:tr.kind==='story'?150:45)*(b.rematch?.6:1)*(b.double?1.4:1));
  state.money+=money;
  if(!isDone(tr.key))state.defeated.push(tr.key);
  let txt=`🏅 ${b.rematch?tr.name+': "Wieder verloren!"':tr.win}<br>💰 +${money} Münzen!`;
  if(b.double)txt+=' (Doppelkampf-Bonus)';
  if(tr.kind==='boss'&&state.area<7&&tr.key.endsWith('-boss'))txt+='<br>🚪 Das Tor ist jetzt offen!';
  if(tr.kind==='rival')txt+='<br>Er zieht weiter ins nächste Gebiet...';
  const sc=scrollForTrainer(tr);
  if(sc&&!b.rematch&&!(state.scrolls||[]).includes(tr.key)){
    state.scrolls=state.scrolls||[];state.scrolls.push(tr.key);
    addItem(sc,1);
    txt+=`<br>📜 Du erhältst die <b>${ITEMS[sc].name}</b>!<br>`+
         `<span style="opacity:.8">Im Rasthaus beim Lehrer einlösen.</span>`;
  }
  if(tr.key==='hera'&&!b.rematch){
    const mon=makeMonster('valenor',Math.max(50,AREA_DEFS[7].cap));
    markSeen(mon.id);markCaught(mon.id);
    if(state.team.length<6)state.team.push(mon);else state.box.push(mon);
    txt+=`<br>✨ Hera nickt dir zu. <b>Valenor</b> tritt an deine Seite – die Wache geht auf dich über.`;
  }
  if(tr.key==='7route-4'&&!b.rematch){
    addItem('urtonikum',1);
    txt+=`<br>🧪 Gestein-Ausbilder Bor drückt dir noch etwas in die Hand: ein <b>Ur-Tonikum</b>.`;
  }
  if(tr.key==='fork-1-0'&&!b.rematch){
    addItem('heilkraut',1);
    txt+=`<br>📖 Bücherwurm Tilda: "Nimm das mit – man weiß ja nie, was noch kommt."`;
  }
  if(tr.key==='fork-3-0'&&!b.rematch){
    addItem('ueberreste',1);
    txt+=`<br>🐚 Muschelsammler Enno: "Hab da noch was Schönes gefunden, gehört jetzt dir."`;
  }
  if(tr.key==='fork-6-0'&&!b.rematch){
    addItem('schutzstein',1);
    txt+=`<br>🌫️ Nebelläufer Kaspar: "Der hier hat mich schon oft beschützt. Jetzt beschützt er dich."`;
  }
  if(state.area===7&&bossCleared())txt+='<br><b>Alle Meister besiegt! Geh zum Tor. 🏆</b>';
  setMsg(txt);
}
// Ist die Halle eines Gebiets bezwungen, entfällt dort das Level-Limit (bis zum
// Endgame-Maximum) - sonst verpufft XP durch Kämpfe in längst gemeisterten Gebieten.
function effectiveCap(a){
  a=a===undefined?state.area:a;
  return arenaCleared(a)?AREA_DEFS[AREA_DEFS.length-1].cap:AREA_DEFS[a].cap;
}
// Die restlichen Kryptiden erhalten die Hälfte – ohne Animation
function shareXp(xp,active,only){
  const cap=effectiveCap();
  const share=Math.max(1,Math.floor(xp*.5));
  const grown=[],gelernt=[],offen=[];
  (only||state.team).forEach(m=>{
    if(m===active)return;
    let rest=share;
    let ups=0;
    while(rest>0){
      if(m.level>=cap){m.xp=m.xpNext;break;}
      const need=m.xpNext-m.xp;
      if(rest<need){m.xp+=rest;rest=0;break;}
      rest-=need;m.level++;m.xp=0;m.xpNext=m.level*45;ups++;
      const before=m.maxHp,warOhnmaechtig=m.hp<=0;
      refreshStats(m);
      if(warOhnmaechtig)m.hp=0;                       // bleibt erschöpft
      else m.hp=Math.min(m.maxHp,m.hp+Math.max(0,m.maxHp-before));
      // Attacken automatisch lernen, solange Platz ist
      (LEARNSETS[FAMILY_OF[m.id]]||[]).forEach(pair=>{
        if(pair[0]===m.level&&m.moves.indexOf(pair[1])<0){
          if(m.moves.length<4){m.moves.push(pair[1]);m.ap=apFor(m.moves);
            gelernt.push(mName(m)+' → '+MOVES[pair[1]].name);}
          else offen.push({mon:m,move:pair[1]});   // volle Liste: später im Menü
        }
      });
      while(canEvolve(m)){
        m.id=DEX[m.id].evo;refreshStats(m);markCaught(m.id);
      }
    }
    if(ups)grown.push(mName(m)+' Lv.'+m.level);
  });
  offen.forEach(o=>{
    if(state.pendingLearn.some(x=>x.mon===o.mon&&x.move===o.move))return;
    state.pendingLearn.push(o);
  });
  return{grown,gelernt,offen:offen.length};
}
async function grantXp(p,xp,quiet){
  const cap=effectiveCap();
  let rest=xp,capped=false;
  while(rest>0){
    // Level-Limit erreicht: Balken läuft voll und bleibt stehen
    if(p.level>=cap){p.xp=p.xpNext;if(!quiet)await xpSettled();capped=true;break;}
    const need=p.xpNext-p.xp;
    if(rest<need){
      p.xp+=rest;rest=0;
      if(!quiet)await xpSettled();else await wait(120);
      break;
    }
    // Balken sichtbar bis ganz voll laufen lassen ...
    rest-=need;p.xp=p.xpNext;
    if(!quiet){await xpSettled();await wait(180);}
    // ... dann Levelaufstieg und Balken zurück auf leer
    p.level++;p.xp=0;p.xpNext=p.level*45;if(!quiet)fx.dispXp=0;
    const before=p.maxHp;refreshStats(p);p.hp+=Math.max(0,p.maxHp-before);
    const lp=fxPos(p);
    fx.texts.push({x:lp.x,y:lp.y,txt:'LEVEL '+p.level,col:'#7fe0a0',life:1.4,size:14});
    fx.flash=.4;fx.flashCol='140,240,180';
    setMsg(`<b>${mName(p)}</b> erreicht Level ${p.level}! 💪`);await readPause();
    await learnAtLevel(p);
    // Entwicklung wird für den Kampfabschluss vorgemerkt
    if(canEvolve(p)&&state.pendingEvo.indexOf(p)<0){
      state.pendingEvo.push(p);
      setMsg(`<b>${mName(p)}</b> wirkt seltsam unruhig...`);await readPause();
    }
  }
  if(capped){setMsg(`<b>${mName(p)}</b> hat das Level-Limit erreicht (Lv.${cap}).`);await readPause();}
}

// Sicherheitsabfrage vor dem Vergessen
function confirmBox(frage,jaText,neinText){
  return new Promise(res=>{
    const g=$('actionSub');g.innerHTML='';
    setMsg(frage);
    const ja=document.createElement('button');ja.textContent=jaText;
    ja.onclick=()=>res(true);g.appendChild(ja);
    const nein=document.createElement('button');nein.className='secondary';nein.textContent=neinText;
    nein.onclick=()=>res(false);g.appendChild(nein);
    setActions('sub');
  });
}
function askReplace(p,newId){
  return new Promise(res=>{
    const neu=MOVES[newId];
    const g=$('actionSub');g.innerHTML='';
    setMsg(`<b>${mName(p)}</b> kann <b>${neu.name}</b> erlernen:<br>`+
      `<span class="badge" style="background:${TYPE_COLORS[neu.type]}">${neu.type}</span> `+
      `${neu.power?'Stärke '+neu.power:'Effekt'} · Genauigkeit ${moveAcc(neu)}% · AP ${moveAP(neu)}<br>`+
      `<span style="opacity:.85">${moveDesc(neu)}</span><br>`+
      `Es kennt schon 4 Attacken – welche ersetzen?`);
    p.moves.forEach((mid,i)=>{
      const mo=MOVES[mid],btn=document.createElement('button');
      btn.innerHTML=mo.name+'<span class="mv-sub">'+mo.type+' · '+(mo.power?'St.'+mo.power:'Effekt')+
        ' · '+moveAcc(mo)+'% · AP '+moveAP(mo)+'</span>';
      btn.style.background=TYPE_COLORS[mo.type];
      btn.onclick=async()=>{
        const sicher=await confirmBox(
          `<b>${mo.name}</b> vergessen und <b>${neu.name}</b> erlernen?`,'✓ Ja, tauschen','◀ Doch nicht');
        if(sicher){p.moves[i]=newId;p.ap=apFor(p.moves);res(mo.name);}
        else askReplace(p,newId).then(res);
      };
      g.appendChild(btn);
    });
    const s=document.createElement('button');s.className='secondary span2';s.textContent='Nicht erlernen';
    s.onclick=async()=>{
      const sicher=await confirmBox(
        `<b>${neu.name}</b> wirklich <b>nicht</b> erlernen?`,'✓ Nicht erlernen','◀ Doch auswählen');
      if(sicher)res(null);else askReplace(p,newId).then(res);
    };
    g.appendChild(s);
    setActions('sub');
  });
}
async function learnAtLevel(p){
  const set=LEARNSETS[FAMILY_OF[p.id]]||[];
  for(const pair of set){
    if(pair[0]!==p.level)continue;
    const id=pair[1];if(p.moves.indexOf(id)>=0)continue;
    if(p.moves.length<4){
      p.moves.push(id);p.ap=apFor(p.moves);
      const nm=MOVES[id];
      setMsg(`✨ <b>${mName(p)}</b> erlernt <b>${nm.name}</b>!<br>`+
        `<span class="badge" style="background:${TYPE_COLORS[nm.type]}">${nm.type}</span> `+
        `${nm.power?'Stärke '+nm.power:'Effekt'} · ${moveAcc(nm)}% · AP ${moveAP(nm)}<br>`+
        `<span style="opacity:.85">${moveDesc(nm)}</span>`);
      await readPause();
    }else{
      const rep=await askReplace(p,id);lockActions();
      setMsg(rep?`<b>${mName(p)}</b> vergisst <b>${rep}</b> und erlernt <b>${MOVES[id].name}</b>!`
                :`<b>${mName(p)}</b> hat <b>${MOVES[id].name}</b> nicht erlernt.`);
      await readPause();
    }
  }
}

// ============================ DOPPELKAMPF ============================
function selectorMon(){
  const b=state.battle;
  if(!b||!b.double||!b.orders)return null;
  const alive=pActive().filter(m=>m.hp>0);
  return alive[b.orders.length]||null;
}
function startSelection(){
  const b=state.battle;
  b.orders=[];
  promptNext();
}
function promptNext(){
  const b=state.battle;
  const m=selectorMon();
  if(!m){doRoundDouble();return;}
  const vorher=b.orders.length
    ? `<br><span style="opacity:.75">Zuvor: ${mName(b.orders[b.orders.length-1].m)} → ${b.orders[b.orders.length-1].move.name}</span>`
    : '';
  setMsg(`Was soll <b>${mName(m)}</b> tun?`+vorher);
  setActions('main');
}
// letzte Auswahl zurücknehmen
function undoOrder(){
  const b=state.battle;
  if(!b||!b.double||!b.orders||!b.orders.length)return;
  const weg=b.orders.pop();
  setMsg(`Auswahl von <b>${mName(weg.m)}</b> zurückgenommen.`);
  setTimeout(promptNext,500);
}
function chooseDoubleMove(i){
  const b=state.battle,m=selectorMon();
  if(!m)return;
  const mv=mMoves(m)[i];if(!mv)return;
  const foes=eActive().filter(x=>x.hp>0);
  if(foes.length===0)return;
  if(mv.hitsAll||foes.length===1){b.orders.push({m,move:mv,target:foes.length===1?foes[0]:null,slot:i});promptNext();return;}
  const g=$('actionSub');g.innerHTML='';
  setMsg(`<b>${mName(m)}</b> setzt <b>${mv.name}</b> ein – auf wen?`);
  foes.forEach(f=>{
    const btn=document.createElement('button');
    btn.innerHTML=mName(f)+'<span class="mv-sub">Lv'+f.level+' · '+Math.max(0,f.hp)+'/'+f.maxHp+' KP</span>';
    btn.style.background=TYPE_COLORS[mType(f)];btn.style.boxShadow='0 3px 0 rgba(0,0,0,.32)';
    btn.onclick=()=>{b.orders.push({m,move:mv,target:f,slot:i});promptNext();};
    g.appendChild(btn);
  });
  const c=document.createElement('button');c.className='secondary span2';c.textContent='◀ Andere Attacke';
  c.onclick=()=>showMoves();
  g.appendChild(c);
  setActions('sub');
}
// Beutel im Doppelkampf: kostet den Zug der ausgewählten Kryptide, Ziel frei wählbar
function showBagDouble(){
  const b=state.battle,m=selectorMon();
  if(!m)return;
  const g=$('actionSub');g.innerHTML='';
  const keys=Object.keys(state.bag).filter(k=>ITEMS[k]&&ITEMS[k].kind!=='ball'&&ITEMS[k].kind!=='held'&&ITEMS[k].kind!=='scroll'&&ITEMS[k].kind!=='relic'&&state.bag[k]>0);
  setMsg(keys.length?`Item auswählen – kostet <b>${mName(m)}</b>s Zug.`:'Dein Beutel ist leer.');
  keys.forEach(k=>{
    const it=ITEMS[k],btn=document.createElement('button');
    btn.innerHTML=it.name+' ×'+state.bag[k]+'<span class="mv-sub">'+it.desc+'</span>';
    btn.onclick=()=>showBagDoubleTarget(k);
    g.appendChild(btn);
  });
  const c=document.createElement('button');c.className='secondary span2';c.textContent='◀ Zurück';
  c.onclick=()=>promptNext();g.appendChild(c);
  setActions('sub');
}
// Zielwahl für das gewählte Item - jedes passende Team-Mitglied ist wählbar,
// nicht nur das gerade ziehende Kryptid (vorher fest verdrahtet, das wirkte willkürlich).
function showBagDoubleTarget(k){
  const b=state.battle,m=selectorMon();
  if(!m)return;
  const it=ITEMS[k];
  const g=$('actionSub');g.innerHTML='';
  let passend;
  if(it.kind==='heal')passend=state.team.map((mm,i)=>({mm,i})).filter(x=>x.mm.hp>0&&x.mm.hp<x.mm.maxHp);
  else if(it.kind==='cure')passend=state.team.map((mm,i)=>({mm,i})).filter(x=>x.mm.hp>0&&x.mm.status);
  else if(it.kind==='revive')passend=state.team.map((mm,i)=>({mm,i})).filter(x=>x.mm.hp<=0);
  else passend=[];
  if(!passend.length){
    setMsg(it.kind==='heal'?'Niemand im Team ist verletzt.':it.kind==='cure'?'Niemand hat ein Statusproblem.':'Kein Gefährte ist erschöpft.');
    setTimeout(()=>showBagDouble(),900);return;
  }
  setMsg(`<b>${it.name}</b> bei wem einsetzen?`);
  passend.forEach(({mm})=>{
    const btn=document.createElement('button');
    btn.innerHTML=mName(mm)+'<span class="mv-sub">'+Math.max(0,mm.hp)+'/'+mm.maxHp+' KP '+statusIcon(mm)+'</span>';
    btn.onclick=()=>{
      if(it.kind==='heal'){
        const h=Math.min(it.amount,mm.maxHp-mm.hp);
        mm.hp+=h;fxGain(mm,h);useItemCount(k);
        setMsg(`<b>${mName(mm)}</b> erhält ${h} KP zurück!`);
      }else if(it.kind==='cure'){
        setMsg(`<b>${mName(mm)}</b> ist von ${STATUS[mm.status].name} geheilt!`);
        mm.status=null;useItemCount(k);
      }else if(it.kind==='revive'){
        mm.hp=Math.floor(mm.maxHp/2);mm._disp=mm.hp;useItemCount(k);
        setMsg(`<b>${mName(mm)}</b> wurde wiederbelebt!`);
      }
      b.orders.push({m,move:null,target:null});
      setTimeout(promptNext,700);
    };
    g.appendChild(btn);
  });
  const c=document.createElement('button');c.className='secondary span2';c.textContent='◀ Anderes Item';
  c.onclick=()=>showBagDouble();g.appendChild(c);
  setActions('sub');
}
// Wechsel im Doppelkampf: kostet ebenfalls den Zug
function aiTarget(e,foes){
  let best=foes[0],bs=-1;
  foes.forEach(f=>{
    const mv=aiChoose(e,f);
    const sc=mv.power>0?calcDamage(e,mv,f).dmg/Math.max(1,f.hp):0;
    if(sc>bs){bs=sc;best=f;}
  });
  return best;
}
async function resolveFaints(){
  const b=state.battle;
  // Gegner ersetzen
  for(let sIdx=0;sIdx<b.eSlots.length;sIdx++){
    const i=b.eSlots[sIdx];
    if(i==null)continue;
    const m=b.enemyTeam[i];
    if(!m||m.hp>0)continue;
    setMsg(`<b>${mName(m)}</b> wurde besiegt!`);
    await readPause();
    const xp=Math.floor(m.level*22*1.4*.75);
    const act=pActive().filter(x=>x&&x.hp>0);
    for(const pm of act){
      setMsg(`+${xp} Einsicht für ${mName(pm)}`);
      await grantXp(pm,xp,true);
    }
    // Bank erhält die Hälfte
    const bench=state.team.filter(m=>act.indexOf(m)<0);
    if(bench.length){
      const share=Math.max(1,Math.floor(xp*.5));
      const grown=[];
      bench.forEach(m=>{const g=shareXp(xp,null,[m]);g.grown.forEach(x=>grown.push(x));});
      setMsg(`Die Bank erhält je ${share} Einsicht.`+(grown.length?`<br>⬆️ ${grown.join(' · ')}`:''));
      await readPause();
    }
    let next=null;
    for(let k=0;k<b.enemyTeam.length;k++){
      if(b.eSlots.indexOf(k)>=0)continue;
      if(b.enemyTeam[k].hp>0){next=k;break;}
    }
    if(next!=null){
      b.eSlots[sIdx]=next;
      const nm=b.enemyTeam[next];resetStages(nm);nm._disp=nm.hp;
      setMsg(`${b.trainer.name} schickt <b>${mName(nm)}</b>!`);await readPause();
    }else b.eSlots[sIdx]=null;
  }
  if(b.eSlots.every(i=>i==null)){
    b.over=true;trainerWinRewards();saveGame(true);continueTo(enterWorld);return true;
  }
  // Eigene ersetzen
  for(let sIdx=0;sIdx<b.pSlots.length;sIdx++){
    const i=b.pSlots[sIdx];
    if(i==null)continue;
    const m=state.team[i];
    if(!m||m.hp>0)continue;
    setMsg(`<b>${mName(m)}</b> ist erschöpft!`);await readPause();
    const bench=state.team.map((mm,k)=>({mm,k})).filter(x=>x.mm.hp>0&&b.pSlots.indexOf(x.k)<0);
    if(!bench.length){b.pSlots[sIdx]=null;continue;}
    await new Promise(res=>{
      const g=$('actionSub');g.innerHTML='';
      setMsg('Wen schickst du als Nächstes?');
      bench.forEach(({mm,k})=>{
        const btn=document.createElement('button');
        btn.innerHTML=mName(mm)+'<span class="mv-sub">Lv'+mm.level+' · '+mm.hp+'/'+mm.maxHp+' KP '+statusIcon(mm)+'</span>';
        btn.onclick=()=>{b.pSlots[sIdx]=k;resetStages(mm);mm._disp=mm.hp;res();};
        g.appendChild(btn);
      });
      setActions('sub');
    });
    lockActions();
    setMsg(`Los, <b>${mName(state.team[b.pSlots[sIdx]])}</b>!`);await wait(600);
  }
  if(b.pSlots.every(i=>i==null)){
    b.over=true;
    setMsg('Deine ganze Gefährten-Riege ist erschöpft... Du wachst im Rasthaus auf.');
    healAll();
    state.loc='stadt';state.px=CITY_DEFS[state.area].doorH[0];state.py=CITY_DEFS[state.area].doorH[1]+1;
    const lost=Math.floor(state.money*.15);state.money-=lost;
    await wait(900);
    setMsg(`Dein Team wurde geheilt. (💰 -${lost} Münzen für die Pflege)`);
    saveGame(true);continueTo(enterWorld);return true;
  }
  return false;
}
async function doRoundDouble(){
  const b=state.battle;
  b.busy=true;lockActions();
  const acts=b.orders.filter(o=>o.m&&o.m.hp>0&&o.move)
    .map(o=>({att:o.m,move:o.move,target:o.target,side:'p',slot:o.slot}));
  const chosen=[];
  eActive().forEach(e=>{
    if(e.hp<=0)return;
    const foes=pActive().filter(m=>m.hp>0);
    if(!foes.length)return;
    let tgt=aiTarget(e,foes);
    // Nicht beide Gegner auf dasselbe Ziel – sonst fällt es vor seinem Zug
    if(chosen.indexOf(tgt)>=0&&foes.length>1&&Math.random()<.7){
      const alt=foes.filter(f=>f!==tgt);
      tgt=alt[Math.floor(Math.random()*alt.length)];
    }
    chosen.push(tgt);
    const ei=aiChooseIdx(e,tgt);
    acts.push({att:e,move:mMoves(e)[ei]||VERZWEIFLER,target:tgt,side:'e',slot:ei});
  });
  acts.sort((x,y)=>effSpd(y.att)-effSpd(x.att));
  for(const a of acts){
    if(b.over)return;
    if(a.att.hp<=0)continue;
    if(a.move.hitsAll){
      const foes=(a.side==='p'?eActive():pActive()).filter(m=>m.hp>0);
      if(!foes.length)continue;
      if(a.side==='e'&&await bossMayHeal(a.att))continue;
      const mv=foes.length>1?Object.assign({},a.move,{power:Math.round(a.move.power*.75)}):a.move;
      for(const f of foes){
        if(a.att.hp<=0)break;
        await applyMove(a.att,f,mv,a.side==='p',a.slot);
        if(await resolveFaints())return;
      }
      continue;
    }
    let t=a.target;
    if(!t||t.hp<=0){
      const foes=(a.side==='p'?eActive():pActive()).filter(m=>m.hp>0);
      if(!foes.length)break;
      t=foes[0];
    }
    if(a.side==='e'&&await bossMayHeal(a.att))continue;
    await applyMove(a.att,t,a.move,a.side==='p',a.slot);
    if(await resolveFaints())return;
  }
  await endOfTurn();
  if(await resolveFaints())return;
  b.busy=false;
  startSelection();
}

async function playerFaint(){
  const b=state.battle;
  setMsg(`<b>${mName(lead())}</b> ist erschöpft!`);drawBattle();await readPause();
  if(state.team.filter(m=>m.hp>0).length===0){
    setMsg('Deine ganze Gefährten-Riege ist erschöpft... Du wachst im Rasthaus auf.');
    healAll();
    state.loc='stadt';state.px=CITY_DEFS[state.area].doorH[0];state.py=CITY_DEFS[state.area].doorH[1]+1;
    const lost=Math.floor(state.money*.15);state.money-=lost;
    b.over=true;
    await wait(600);
    setMsg(`Dein Team wurde geheilt. (💰 -${lost} Münzen für die Pflege)`);
    saveGame(true);continueTo(enterWorld);return;
  }
  showSwitch(true);
}

function showSwitch(forced){
  const b=state.battle,g=$('actionSub');g.innerHTML='';
  state.team.forEach((m,i)=>{
    if(m.hp<=0||i===state.leadIdx)return;
    const btn=document.createElement('button');
    btn.innerHTML=mName(m)+'<span class="mv-sub">Lv'+m.level+' · '+m.hp+'/'+m.maxHp+' KP '+statusIcon(m)+'</span>';
    btn.onclick=()=>{
      state.leadIdx=i;resetStages(m);m._disp=m.hp;fx.dispXp=m.xp;
      if(forced){setMsg(`Los, <b>${mName(m)}</b>!`);b.busy=false;setActions('main');}
      else doRound({type:'switch',run:async()=>{setMsg(`Los, <b>${mName(m)}</b>!`);await wait(700);return true;}});
    };
    g.appendChild(btn);
  });
  if(!forced){
    const c=document.createElement('button');c.className='secondary span2';c.textContent='Abbrechen';
    c.onclick=()=>setActions('main');g.appendChild(c);
    setMsg('Wen einwechseln? (Der Gegner greift danach an!)');
  }else setMsg('Wähle dein nächstes Monster!');
  setActions('sub');
}

// Attackenauswahl
function showMoves(){
  const b=state.battle;if(!b)return;
  const p=b.double?(selectorMon()||lead()):lead();
  const mv=mMoves(p);
  const g=$('actionSub');g.innerHTML='';
  setMsg(b.double
    ? `Welche Attacke soll <b>${mName(p)}</b> einsetzen?`
    : `Welche Attacke soll <b>${mName(p)}</b> einsetzen?`);
  mv.forEach((m,i)=>{
    const ap=apOf(p,i),apMax=maxAPof(p,i),acc=moveAcc(m);
    const btn=document.createElement('button');
    btn.innerHTML=m.name+'<span class="mv-sub">'+m.type+' · '+
      (m.power>0?'St. '+m.power:'Effekt')+(acc<100?' · '+acc+'%':'')+' · AP '+ap+'/'+apMax+'</span>';
    btn.style.background=TYPE_COLORS[m.type];
    btn.style.boxShadow='0 3px 0 rgba(0,0,0,.32)';
    if(ap<=0){btn.style.background='#8a8298';btn.disabled=true;}
    btn.onclick=()=>{
      if(b.busy||b.over)return;
      if(b.double)return chooseDoubleMove(i);
      doRound({type:'move',idx:i});
    };
    g.appendChild(btn);
  });
  const c=document.createElement('button');c.className='secondary span2';c.textContent='◀ Zurück';
  c.onclick=()=>{setActions('main');};
  g.appendChild(c);
  setActions('sub');
}
function showBag(inBattle){
  const b=state.battle;
  const g=$('actionSub');g.innerHTML='';
  const fangbar=b&&b.kind==='wild'&&!b.double&&
    !(state.team.length>=6&&state.box.length>=30);
  const keys=Object.keys(state.bag).filter(k=>{
    const it=ITEMS[k];if(!it||state.bag[k]<=0)return false;
    if(it.kind==='held'||it.kind==='scroll'||it.kind==='relic')return false;
    if(it.kind==='ball')return fangbar;
    return true;
  });
  if(!keys.length){setMsg('Hier ist gerade nichts Brauchbares im Beutel.');}
  else setMsg('Was möchtest du benutzen?');
  keys.forEach(k=>{
    const it=ITEMS[k],btn=document.createElement('button');
    const istKugel=it.kind==='ball';
    btn.innerHTML=(istKugel?'🔴 ':'')+it.name+' ×'+state.bag[k]+
      '<span class="mv-sub">'+it.desc+'</span>';
    if(istKugel){btn.style.background='#c94f6d';btn.style.boxShadow='0 3px 0 #9a3550';}
    btn.onclick=()=>istKugel?tryCatch(k):useItem(k);
    g.appendChild(btn);
  });
  const c=document.createElement('button');c.className='secondary span2';c.textContent='◀ Zurück';
  c.onclick=()=>setActions('main');g.appendChild(c);
  setActions('sub');
}
function useItem(k){
  const it=ITEMS[k];
  // Heilung und Gegenmittel: Ziel im Team wählen
  if(it.kind==='heal'||it.kind==='cure'){
    const g=$('actionSub');g.innerHTML='';
    const passend=state.team.map((m,i)=>({m,i})).filter(x=>
      it.kind==='heal' ? (x.m.hp>0&&x.m.hp<x.m.maxHp) : (x.m.hp>0&&x.m.status));
    if(!passend.length){
      setMsg(it.kind==='heal'?'Niemand im Team ist verletzt.':'Niemand hat ein Statusproblem.');
      setTimeout(()=>showBag(true),900);return;
    }
    setMsg(`<b>${it.name}</b> bei wem einsetzen?`);
    passend.forEach(({m})=>{
      const btn=document.createElement('button');
      btn.innerHTML=mName(m)+'<span class="mv-sub">'+Math.max(0,m.hp)+'/'+m.maxHp+' KP '+statusIcon(m)+'</span>';
      btn.onclick=()=>doRound({type:'item',run:async()=>{
        if(it.kind==='heal'){
          const h=Math.min(it.amount,m.maxHp-m.hp);
          m.hp+=h;fxGain(m,h);useItemCount(k);
          setMsg(`<b>${mName(m)}</b> erhält ${h} KP zurück!`);
        }else{
          setMsg(`<b>${mName(m)}</b> ist von ${STATUS[m.status].name} geheilt!`);
          m.status=null;useItemCount(k);
        }
        await hpSettled();await readPause();return true;
      }});
      g.appendChild(btn);
    });
    const c=document.createElement('button');c.className='secondary span2';c.textContent='◀ Zurück';
    c.onclick=()=>showBag(true);g.appendChild(c);
    setActions('sub');return;
  }
  if(it.kind==='revive'){
    const g=$('actionSub');g.innerHTML='';
    const fainted=state.team.map((m,i)=>({m,i})).filter(x=>x.m.hp<=0);
    if(!fainted.length){setMsg('Kein Gefährte ist erschöpft.');setTimeout(()=>showBag(true),900);return;}
    fainted.forEach(({m,i})=>{
      const b=document.createElement('button');b.textContent=mName(m)+' Lv'+m.level;
      b.onclick=()=>doRound({type:'item',run:async()=>{
        m.hp=Math.floor(m.maxHp/2);useItemCount(k);
        setMsg(`<b>${mName(m)}</b> wurde wiederbelebt!`);await wait(900);return true;}});
      g.appendChild(b);
    });
    setMsg('Welches Monster wiederbeleben?');setActions('sub');return;
  }
  if(it.kind==='ap'){
    const g=$('actionSub');g.innerHTML='';
    const passend=state.team.map((m,i)=>({m,i})).filter(x=>x.m.hp>0&&mMoves(x.m).some((mv,mi)=>apOf(x.m,mi)<maxAPof(x.m,mi)));
    if(!passend.length){
      setMsg('Bei niemandem fehlt gerade AP.');setTimeout(()=>showBag(true),900);return;
    }
    setMsg(`<b>${it.name}</b> bei wem einsetzen?`);
    passend.forEach(({m})=>{
      const btn=document.createElement('button');
      btn.innerHTML=mName(m)+'<span class="mv-sub">'+mMoves(m).map((mv,mi)=>apOf(m,mi)).join('/')+' AP übrig</span>';
      btn.onclick=()=>{
        if(it.scope==='all'){
          doRound({type:'item',run:async()=>{
            restoreAP(m);useItemCount(k);
            setMsg(`<b>${mName(m)}</b>s Attacken sind wieder vollständig einsatzbereit!`);
            await wait(900);return true;
          }});
        }else{
          const g2=$('actionSub');g2.innerHTML='';
          setMsg('Welche Attacke auffüllen?');
          mMoves(m).forEach((mv,mi)=>{
            const b2=document.createElement('button');
            b2.innerHTML=mv.name+'<span class="mv-sub">'+apOf(m,mi)+'/'+maxAPof(m,mi)+' AP</span>';
            b2.disabled=apOf(m,mi)>=maxAPof(m,mi);
            b2.onclick=()=>doRound({type:'item',run:async()=>{
              m.ap[mi]=maxAPof(m,mi);useItemCount(k);
              setMsg(`<b>${mv.name}</b> ist wieder voll einsatzbereit!`);
              await wait(900);return true;
            }});
            g2.appendChild(b2);
          });
          const c2=document.createElement('button');c2.className='secondary span2';c2.textContent='◀ Zurück';
          c2.onclick=()=>useItem(k);g2.appendChild(c2);
          setActions('sub');
        }
      };
      g.appendChild(btn);
    });
    const c=document.createElement('button');c.className='secondary span2';c.textContent='◀ Zurück';
    c.onclick=()=>showBag(true);g.appendChild(c);
    setActions('sub');return;
  }
  doRound({type:'item',run:async()=>{
    const p=lead();
    if(it.kind==='heal'){
      const h=Math.min(it.amount,p.maxHp-p.hp);
      if(h<=0){setMsg('KP sind bereits voll!');await wait(800);return false;}
      p.hp+=h;fxGain(p,h);useItemCount(k);setMsg(`<b>${mName(p)}</b> erhält ${h} KP zurück!`);
    }else if(it.kind==='cure'){
      if(!p.status){setMsg('Kein Statusproblem vorhanden!');await wait(800);return false;}
      setMsg(`<b>${mName(p)}</b> ist von ${STATUS[p.status].name} geheilt!`);p.status=null;useItemCount(k);
    }
    await hpSettled();await wait(500);return true;
  }});
}

function ballMult(itemKey,enemy){
  const it=ITEMS[itemKey];
  if(it.matchType&&enemy&&mTypes(enemy).includes(it.matchType))return it.matchMult;
  return it.mult;
}
function tryCatch(ballKey){
  doRound({type:'catch',run:async()=>{
    const b=state.battle,e=b.enemy();
    useItemCount(ballKey);
    setMsg(`Du hältst einen ${ITEMS[ballKey].name} zu <b>${mName(e)}</b>...`);
    for(let i=0;i<3;i++){fx.flash=.6;fx.flashCol='255,90,90';e._shake=5;await wait(420);}
    let chance=(.72-(e.hp/e.maxHp)*.55)*ballMult(ballKey,e);
    if(e.status)chance+=.12;
    if(b.legend)chance*=.32;
    chance=Math.max(.04,Math.min(b.legend?.6:.95,chance));
    if(Math.random()<chance){
      b.over=true;markCaught(e.id);
      let sc='';
      if(b.legend&&state.legends.indexOf(b.legend.key)<0){
        state.legends.push(b.legend.key);sc=grantLegendScroll();
      }
      if(state.team.length<6){state.team.push(e);setMsg(`🎉 <b>${mName(e)}</b> hat sich deinen Gefährten angeschlossen!`+sc);}
      else{state.box.push(e);setMsg(`🎉 <b>${mName(e)}</b> hat sich gebunden!<br>Gefährten voll – es wartet in der 📦 Box.`+sc);}
      saveGame(true);continueTo(enterWorld);
      return false;
    }
    setMsg(`<b>${mName(e)}</b> löst sich wieder und weicht zurück!`);await readPause();return true;
  }});
}
function tryFlee(){
  doRound({type:'flee',run:async()=>{
    const b=state.battle;
    if(Math.random()<.85){setMsg('Du bist entkommen!');b.over=true;await wait(600);continueTo(enterWorld);return false;}
    setMsg('Flucht gescheitert!');await wait(700);return true;
  }});
}

$('msgBox').addEventListener('click',()=>{if(skipFn)skipFn();});
$('btnFight').addEventListener('click',()=>{
  const b=state.battle;if(!b||b.busy||b.over)return;
  showMoves();
});
$('btnCatch').addEventListener('click',()=>{const b=state.battle;if(!b||b.busy||b.over)return;showSelfInfo();});
$('btnFlee').addEventListener('click',()=>{
  const b=state.battle;if(!b||b.busy||b.over)return;
  if(b.double)return undoOrder();
  showSelfInfo();
});
$('btnSwitch').addEventListener('click',()=>{
  const b=state.battle;if(!b||b.busy||b.over||b.double)return;
  if(b.kind!=='wild')return;
  tryFlee();
});
$('btnBag').addEventListener('click',()=>{const b=state.battle;if(!b||b.busy||b.over)return;if(b.double)return showBagDouble();showBag(true);});
// Der Team-Knopf ersetzt das frühere Wechseln-Menü

// ============================ MENÜ ============================
function makeCanvas(px){
  const cv=document.createElement('canvas');
  const n=px||36;cv.width=n;cv.height=n;
  cv.style.imageRendering='pixelated';return cv;
}
function statusIcon2(m){return m.status?STATUS[m.status].icon:'';}

// ---- kompakte Zeile ----
function monRow(m,opts){
  const row=document.createElement('div');
  row.className='row'+(opts.lead?' lead':'')+(m.hp<=0?' faint':'');
  const cv=makeCanvas(36);row.appendChild(cv);
  const pct=Math.max(0,m.hp/m.maxHp);
  const col=pct<=.2?'#d95b43':pct<=.5?'#e8b93c':'#5aa464';
  const held=m.held&&ITEMS[m.held]?' 🎽':'';
  const info=document.createElement('div');
  info.className='rn';
  info.innerHTML=
    `<b>${mName(m)}</b> ${typeBadges(m)} <span style="opacity:.75">Lv.${m.level}</span>`+
    `${opts.lead?' ⭐':''}${statusIcon2(m)}${held}`+
    `<div class="mini"><div style="width:${pct*100}%;background:${col}"></div></div>`+
    `<span style="opacity:.7">${Math.max(0,m.hp)}/${m.maxHp} KP</span>`;
  row.appendChild(info);
  const ch=document.createElement('div');ch.className='chev';ch.textContent='›';
  row.appendChild(ch);
  row.onclick=opts.onClick;
  return{row,cv};
}

// ---- Detailansicht ----
function renderDetail(){
  const d=state._detail;
  const inTeam=d.kind==='team';
  const arr=inTeam?state.team:state.box;
  const m=arr[d.idx];
  if(!m){state._detail=null;return renderMenu();}
  const list=$('menuList');list.innerHTML='';
  const box=document.createElement('div');box.className='det';
  const pct=Math.max(0,m.hp/m.maxHp);
  const col=pct<=.2?'#d95b43':pct<=.5?'#e8b93c':'#5aa464';
  const xp=Math.min(1,m.xp/m.xpNext);
  const ab=abilOf(m),dx=DEX[m.id];
  const evo=dx.evo?`Entwickelt sich ab Lv.${dx.evoLvl}`:'Voll entwickelt';
  box.innerHTML=
    `<div class="dtop"><div id="detSprite"></div><div style="flex:1">
      <b style="font-size:13px">${mName(m)}</b> ${typeBadges(m)}<br>
      <span style="opacity:.8">Lv.${m.level} · ${evo}</span>
      <div class="mini"><div style="width:${pct*100}%;background:${col}"></div></div>
      <span style="opacity:.75">${Math.max(0,m.hp)}/${m.maxHp} KP</span>
      <div class="mini"><div style="width:${xp*100}%;background:#4a9fd8"></div></div>
      <span style="opacity:.75">Einsicht ${m.xp}/${m.xpNext}</span>
    </div></div>
    <div class="stats">
      <div>ANG<b>${m.atk}</b></div><div>VER<b>${m.def}</b></div><div>INI<b>${m.spd}</b></div>
    </div>
    <div style="font-size:10.5px">
      ${ab?`<span class="badge" style="background:#5c5470">${ABILITIES[ab].name}</span> <span style="opacity:.75">${ABILITIES[ab].desc}</span><br>`:''}
      ${m.held&&ITEMS[m.held]?`<span class="badge" style="background:#a8894a">🎽 ${ITEMS[m.held].name}</span> <span style="opacity:.75">${ITEMS[m.held].desc}</span>`:'<span style="opacity:.6">Kein Tragitem</span>'}
      ${m.status?`<br><span class="badge" style="background:${STATUS[m.status].color}">${STATUS[m.status].name}</span>`:''}
    </div>
    <div class="sect">ATTACKEN</div>
    <div class="mvlist">${mMoves(m).map(x=>
      `<div class="mvrow">
         <span class="mvname" style="background:${TYPE_COLORS[x.type]}">${x.name}</span>
         <span class="mvmeta">${x.type}${x.power?' · Stärke '+x.power:' · Statuswirkung'}</span>
         <div class="mvdesc">${moveDesc(x)}</div>
       </div>`).join('')}</div>`;
  list.appendChild(box);
  const cv=makeCanvas(60);
  box.querySelector('#detSprite').appendChild(cv);
  monCanvas(cv,m.id,m.shiny);

  // Spitzname
  const nameBox=document.createElement('div');
  nameBox.style.cssText='margin-top:7px';
  nameBox.innerHTML=
    `<div class="sect" style="margin-top:0">SPITZNAME</div>
     <div style="display:flex;gap:5px">
       <input id="nickInput" maxlength="12" placeholder="${artName(m)}" value="${(m.nick||'').replace(/"/g,'&quot;')}"
         style="flex:1;min-width:0;font-family:inherit;font-size:11.5px;padding:6px;
                border:2px solid var(--ink);border-radius:7px;-webkit-user-select:text;user-select:text">
     </div>`;
  list.appendChild(nameBox);
  const ng=document.createElement('div');ng.className='action-grid';
  const nSave=document.createElement('button');nSave.textContent='✏️ Übernehmen';
  nSave.onclick=()=>{
    const v=($('nickInput').value||'').trim().slice(0,12);
    m.nick=v||null;
    renderDetail();
    saveStatus(v?'✏️ Heißt jetzt '+v+'.':'✏️ Wieder '+artName(m)+'.');
  };
  ng.appendChild(nSave);
  const nReset=document.createElement('button');nReset.textContent='Zurücksetzen';nReset.className='secondary';
  nReset.onclick=()=>{m.nick=null;renderDetail();saveStatus('✏️ Wieder '+artName(m)+'.');};
  ng.appendChild(nReset);
  list.appendChild(ng);

  const g=document.createElement('div');g.className='action-grid';
  if(inTeam){
    if(d.idx!==state.leadIdx&&m.hp>0){
      const b=document.createElement('button');b.textContent='⭐ Anführer';
      b.onclick=()=>{state.leadIdx=d.idx;renderDetail();};g.appendChild(b);
    }
    const bi=document.createElement('button');bi.textContent='🎽 Tragitem';bi.className='secondary';
    bi.onclick=()=>{state._equip=d.idx;renderMenu();};g.appendChild(bi);
    if(state.team.length>1){
      const bb=document.createElement('button');bb.textContent='📦 In die Box';bb.className='secondary';
      bb.onclick=()=>{
        const mon=state.team.splice(d.idx,1)[0];state.box.push(mon);
        if(state.leadIdx>=state.team.length)state.leadIdx=state.team.length-1;
        state._detail=null;state._tab='team';renderMenu();
        saveStatus('📦 '+mName(mon)+' in die Box gelegt.');
      };g.appendChild(bb);
    }
  }else{
    const bt=document.createElement('button');bt.textContent='➕ Ins Team';
    bt.disabled=state.team.length>=6;
    bt.onclick=()=>{
      const mon=state.box.splice(d.idx,1)[0];state.team.push(mon);
      state._detail=null;state._tab='team';renderMenu();
      saveStatus('✓ '+mName(mon)+' ist jetzt im Team!');
    };g.appendChild(bt);
  }
  const bk=document.createElement('button');bk.textContent='◀ Übersicht';bk.className='secondary span2';
  bk.onclick=()=>{state._detail=null;renderMenu();};g.appendChild(bk);
  list.appendChild(g);
}

// ---- Tragitem wählen ----
function renderEquip(){
  const i=state._equip,m=state.team[i];
  const list=$('menuList');list.innerHTML='';
  const head=document.createElement('div');
  head.className='sect';
  head.innerHTML='🎽 TRAGITEM FÜR '+mName(m).toUpperCase();
  list.appendChild(head);
  const opts=Object.keys(state.bag).filter(k=>ITEMS[k]&&ITEMS[k].kind==='held'&&state.bag[k]>0);
  if(!opts.length){
    const p=document.createElement('div');
    p.style.cssText='font-size:11px;opacity:.75;margin-bottom:6px';
    p.textContent='Keine Tragitems im Beutel. Es gibt sie im Rasthaus.';
    list.appendChild(p);
  }
  opts.forEach(k=>{
    const r=document.createElement('div');r.className='row';
    r.innerHTML=`<div class="rn"><b>${ITEMS[k].name}</b> ×${state.bag[k]}<br>
      <span style="opacity:.75">${ITEMS[k].desc}</span></div><div class="chev">›</div>`;
    r.onclick=()=>{
      if(m.held)addItem(m.held,1);
      useItemCount(k);m.held=k;state._equip=null;
      renderMenu();saveStatus('🎽 '+mName(m)+' trägt jetzt '+ITEMS[k].name+'.');
    };
    list.appendChild(r);
  });
  const g=document.createElement('div');g.className='action-grid';
  if(m.held){
    const off=document.createElement('button');off.textContent='Ablegen';off.className='secondary';
    off.onclick=()=>{addItem(m.held,1);const n=ITEMS[m.held].name;m.held=null;state._equip=null;
      renderMenu();saveStatus('🎽 '+n+' zurück in den Beutel.');};
    g.appendChild(off);
  }
  const c=document.createElement('button');c.textContent='◀ Zurück';c.className='secondary';
  c.onclick=()=>{state._equip=null;renderMenu();};g.appendChild(c);
  list.appendChild(g);
}

// ---- Hauptmenü ----
function renderMenu(){
  const A=areaDef(),W=curWeather();
  $('menuHead').innerHTML=
    `<b>${locName()}</b> · Gebiet ${state.area+1}/8${state.champion?' 🏆':''}<br>`+
    `Limit Lv.${effectiveCap()}${W?' · '+W.icon+' '+W.name:''} · 💰 ${state.money}<br>`+
    `Gefährten ${state.team.length}/6 · Box ${state.box.length} · Katalog ${state.caught.length}/${DEX_ORDER.length}`;
  const tab=state._tab||'team';
  document.querySelectorAll('#menuTabs button').forEach(b=>
    b.classList.toggle('on',b.dataset.tab===tab));
  if(state._equip!=null&&state.team[state._equip])return renderEquip();
  if(state._detail)return renderDetail();
  const list=$('menuList');list.innerHTML='';

  if(tab==='team'){
    state.team.forEach((m,i)=>{
      const{row,cv}=monRow(m,{lead:i===state.leadIdx,
        onClick:()=>{state._detail={kind:'team',idx:i};renderMenu();}});
      list.appendChild(row);monCanvas(cv,m.id,m.shiny);
    });
    const hint=document.createElement('div');
    hint.style.cssText='font-size:10px;opacity:.6;margin-top:4px';
    hint.textContent='Antippen für Details, Anführer, Tragitem und Box.';
    list.appendChild(hint);
  }
  else if(tab==='box'){
    if(!state.box.length){
      const p=document.createElement('div');
      p.style.cssText='font-size:11px;opacity:.7;padding:6px 2px';
      p.textContent='Deine Box ist leer. Gebundene Kryptiden landen hier, wenn deine Gefährten-Riege voll ist.';
      list.appendChild(p);
    }
    state.box.forEach((m,i)=>{
      const{row,cv}=monRow(m,{onClick:()=>{state._detail={kind:'box',idx:i};renderMenu();}});
      list.appendChild(row);monCanvas(cv,m.id,m.shiny);
    });
  }
  else if(tab==='bag'){
    // Anwendung außerhalb des Kampfes
    if(state._useItem){
      const k=state._useItem,it=ITEMS[k];
      const h=document.createElement('div');h.className='sect';
      h.innerHTML=it.name.toUpperCase()+' – bei wem einsetzen?';
      list.appendChild(h);
      const passend=state.team.map((m,i)=>({m,i})).filter(x=>
        it.kind==='heal'   ? (x.m.hp>0&&x.m.hp<x.m.maxHp) :
        it.kind==='cure'   ? (x.m.hp>0&&x.m.status) :
        it.kind==='revive' ? (x.m.hp<=0) : false);
      if(!passend.length){
        const p2=document.createElement('div');
        p2.style.cssText='font-size:11px;opacity:.75;margin-bottom:6px';
        p2.textContent=it.kind==='heal'?'Alle Kryptiden haben volle KP.':
          it.kind==='cure'?'Niemand hat ein Statusproblem.':'Niemand ist erschöpft.';
        list.appendChild(p2);
      }
      passend.forEach(({m,i})=>{
        const{row,cv}=monRow(m,{onClick:()=>{
          if(it.kind==='heal'){
            const g2=Math.min(it.amount,m.maxHp-m.hp);m.hp+=g2;
            saveStatus(`✓ <b>${mName(m)}</b> erhält ${g2} KP zurück.`);
          }else if(it.kind==='cure'){
            saveStatus(`✓ <b>${mName(m)}</b> ist von ${STATUS[m.status].name} geheilt.`);
            m.status=null;
          }else{
            m.hp=Math.floor(m.maxHp/2);
            saveStatus(`✓ <b>${mName(m)}</b> wurde wiederbelebt.`);
          }
          useItemCount(k);state._useItem=null;saveGame(true);renderMenu();
        }});
        list.appendChild(row);monCanvas(cv,m.id,m.shiny);
      });
      const g3=document.createElement('div');g3.className='action-grid';
      const c=document.createElement('button');c.className='secondary span2';c.textContent='◀ Abbrechen';
      c.onclick=()=>{state._useItem=null;renderMenu();};
      g3.appendChild(c);list.appendChild(g3);
      showScreen('team');return;
    }
    const keys=Object.keys(state.bag).filter(k=>ITEMS[k]&&state.bag[k]>0);
    if(!keys.length){
      const p=document.createElement('div');
      p.style.cssText='font-size:11px;opacity:.7;padding:6px 2px';
      p.textContent='Dein Beutel ist leer.';list.appendChild(p);
    }
    const groups=[['ball','BINDUNGSSTEINE'],['heal','HEILUNG'],['cure','HEILUNG'],
      ['revive','HEILUNG'],['ap','AP-AUFFRISCHUNG'],['held','TRAGITEMS'],['relic','RELIKTE']];
    const shown={};
    const hinw=document.createElement('div');
    hinw.style.cssText='font-size:10px;opacity:.65;margin-bottom:5px';
    hinw.textContent='Tränke, Gegenmittel und Beleber lassen sich hier direkt benutzen.';
    list.appendChild(hinw);
    [['HEILUNG',['heal','cure','revive']],['AP-AUFFRISCHUNG',['ap']],['BINDUNGSSTEINE',['ball']],['TRAGITEMS',['held']],
     ['SCHRIFTROLLEN',['scroll']],['RELIKTE',['relic']]].forEach(([title,kinds])=>{
      const ks=keys.filter(k=>kinds.indexOf(ITEMS[k].kind)>=0);
      if(!ks.length)return;
      const h=document.createElement('div');h.className='sect';h.textContent=title;
      list.appendChild(h);
      ks.forEach(k=>{
        const it=ITEMS[k];
        const nutzbar=['heal','cure','revive'].indexOf(it.kind)>=0;
        const r=document.createElement('div');r.className='row';
        if(!nutzbar)r.style.cursor='default';
        r.innerHTML=`<div class="rn"><b>${it.name}</b> ×${state.bag[k]}<br>
          <span style="opacity:.75">${it.desc}</span></div>`+
          (nutzbar?'<div class="chev">›</div>':'');
        if(nutzbar)r.onclick=()=>{state._useItem=k;renderMenu();};
        list.appendChild(r);
      });
    });
  }
  else if(tab==='typen'){
    const h=document.createElement('div');h.className='sect';
    h.textContent='WIRKUNG DER TYPEN';list.appendChild(h);
    const note=document.createElement('div');
    note.style.cssText='font-size:10px;opacity:.7;margin-bottom:5px;line-height:1.4';
    note.textContent='Angriffe eigenen Typs richten 50% mehr Schaden an.';
    list.appendChild(note);
    Object.keys(TYPE_COLORS).forEach(t=>{
      const strong=[],weak=[];
      Object.keys(TYPE_COLORS).forEach(d=>{
        const v=typeMult(t,d);
        if(v>1)strong.push(d);else if(v<1)weak.push(d);
      });
      const r=document.createElement('div');r.className='row';r.style.cursor='default';
      r.innerHTML=`<div class="rn">
        <span class="badge" style="background:${TYPE_COLORS[t]}">${t}</span><br>
        <span style="opacity:.85">stark gegen: ${strong.length?strong.join(', '):'—'}</span><br>
        <span style="opacity:.65">schwach gegen: ${weak.length?weak.join(', '):'—'}</span>
      </div>`;
      list.appendChild(r);
    });
  }
  else if(tab==='karte'){
    const h=document.createElement('div');h.className='sect';
    h.textContent='SCHNELLREISE';list.appendChild(h);
    const note=document.createElement('div');
    note.style.cssText='font-size:10px;opacity:.7;margin-bottom:5px;line-height:1.4';
    note.textContent='Reise kostenlos zu jeder bereits besuchten Stadt.';
    list.appendChild(note);
    const visited=(state.citiesVisited||[]).filter(a=>a!==state.area||state.loc!=='stadt');
    if(!visited.length){
      const p=document.createElement('div');
      p.style.cssText='font-size:11px;opacity:.7;padding:6px 2px';
      p.textContent='Noch keine weitere Stadt zum Hinreisen erkundet.';
      list.appendChild(p);
    }
    visited.forEach(a=>{
      const r=document.createElement('div');r.className='row';
      r.innerHTML=`<div class="rn"><b>${CITY_NAMES[a]}</b><br>
        <span style="opacity:.7;font-size:9px">Gebiet ${a+1}/8</span></div><span>›</span>`;
      r.onclick=()=>{
        gotoLoc('stadt',a,SPAWN_SUED,'🗺️ Schnellreise nach '+CITY_NAMES[a]);
      };
      list.appendChild(r);
    });
  }
  else if(tab==='quests'){
    const h=document.createElement('div');h.className='sect';
    h.textContent='NEBENQUESTS';list.appendChild(h);
    state.quests=state.quests||{};
    QUESTS.forEach(q=>{
      const st=state.quests[q.id]||null;
      const giver=q.giverName||((NPC_DATA[q.area]&&NPC_DATA[q.area][q.npcIdx])?NPC_DATA[q.area][q.npcIdx].n:'?');
      const ort=q.location||CITY_NAMES[q.area];
      let statusTxt,statusCol;
      if(st==='done'){statusTxt='✓ Abgeschlossen';statusCol='#5aa464';}
      else if(st==='guardian'){statusTxt='⚔️ Wächter wartet';statusCol='#c94f6d';}
      else if(st==='active'){statusTxt='… in Arbeit';statusCol='#e8b93c';}
      else{statusTxt='Noch nicht angenommen';statusCol='#9a9285';}
      const progressTxt=(st==='active'&&q.progress)?q.progress():'';
      const r=document.createElement('div');r.className='row';r.style.cursor='default';
      const rewardBits=[];
      if(q.reward.money)rewardBits.push('💰'+q.reward.money);
      if(q.reward.item)rewardBits.push('🎁'+ITEMS[q.reward.item].name);
      if(q.reward.mon)rewardBits.push('✨'+DEX[q.reward.mon].name);
      r.innerHTML=`<div class="rn">
        <b>${q.name}</b> <span style="opacity:.7;font-size:9px">· ${ort} (${giver})</span><br>
        <span style="color:${statusCol};font-weight:bold">${statusTxt}</span>${progressTxt?' <span style="opacity:.75">· '+progressTxt+'</span>':''}<br>
        <span style="opacity:.75">Belohnung: ${rewardBits.join(' · ')}</span>
      </div>`;
      list.appendChild(r);
    });
    const note=document.createElement('div');
    note.style.cssText='font-size:10px;opacity:.6;margin-top:4px';
    note.textContent='Sprich mit den passenden Bewohnern in jeder Stadt, um Quests anzunehmen und abzuschließen.';
    list.appendChild(note);
  }
  else if(tab==='dex'){ showDex(); return; }
  showScreen('team');
  $('codeBox').classList.add('hidden');
}
function showMenu(){
  state._detail=null;state._equip=null;state._useItem=null;
  if(!state._tab||state._tab==='dex')state._tab='team';
  renderMenu();
  $('saveStatus').innerHTML='';
}
document.querySelectorAll('#menuTabs button').forEach(b=>{
  b.addEventListener('click',()=>{
    state._tab=b.dataset.tab;state._detail=null;state._equip=null;
    $('saveStatus').innerHTML='';
    renderMenu();
  });
});

// ---- Dex ----
function showDex(){
  $('dexTitle').textContent='KATALOG  '+state.caught.length+'/'+DEX_ORDER.length;
  const g=$('dexGrid');g.innerHTML='';
  DEX_ORDER.forEach(id=>{
    const seen=state.seen.indexOf(id)>=0,caught=state.caught.indexOf(id)>=0;
    const c=document.createElement('div');c.className='dexcell'+(seen?'':' unknown');
    const cv=document.createElement('canvas');cv.width=36;cv.height=36;c.appendChild(cv);
    c.insertAdjacentHTML('beforeend',`<div>${seen?DEX[id].name:'???'}</div>`+
      (seen&&DEX[id].type2?`<div style="font-size:8px;opacity:.7">${DEX[id].type}/${DEX[id].type2}</div>`:'')+
      (caught?'<div style="color:#5aa464">✓</div>':seen?'<div style="opacity:.6">gesehen</div>':'<div>&nbsp;</div>'));
    g.appendChild(c);
    if(seen)monCanvas(cv,id,false);
    else{const ctx=cv.getContext('2d');ctx.fillStyle='#ccc4b4';
      const N=SP[id]?spriteN(SP[id]):12,px=36/N;
      for(let ry=0;ry<N;ry++)for(let rx=0;rx<N;rx++){
        if(SP[id]&&SP[id].r[ry][rx]!=='.')ctx.fillRect(rx*px,ry*px,px,px);}}
    if(seen){c.style.cursor='pointer';c.addEventListener('click',()=>showDexDetail(id));}
  });
  $('dexDetail').classList.add('hidden');
  showScreen('dex');
}
function showDexDetail(id){
  const d=DEX[id],caught=state.caught.indexOf(id)>=0;
  const cv=document.createElement('canvas');cv.width=72;cv.height=72;
  monCanvas(cv,id,false);
  const body=$('dexDetailBody');
  body.innerHTML='';
  const head=document.createElement('div');
  head.style.cssText='display:flex;align-items:center;gap:10px;margin-bottom:8px;';
  head.innerHTML=`<div><b style="font-size:15px">${d.name}</b><br>${badge(d.type)}${d.type2?' '+badge(d.type2):''}${d.legend?' <span style="opacity:.7;font-size:9px">✨ Legendär</span>':''}</div>`;
  head.prepend(cv);
  body.appendChild(head);
  const lore=document.createElement('div');
  lore.className='mhead';
  lore.innerHTML=(LORE[id]||'Noch keine Aufzeichnungen über dieses Kryptid.')+
    (caught?'':'<div style="margin-top:6px;opacity:.7;font-size:9px">Noch nicht verbündet – im Katalog nur gesehen.</div>');
  body.appendChild(lore);
  $('dexDetail').classList.remove('hidden');
}
document.getElementById('btnDexDetailClose').addEventListener('click',()=>{
  $('dexDetail').classList.add('hidden');
});

// ---- Shop ----
const SHOP_TABS={
  pflege:{title:'🧪 PFLEGE',sub:'Tränke, Beleber und Gegenmittel',kinds:['heal','cure','revive']},
  fang:{title:'🔴 BINDUNG',sub:'Steine, um freilebenden Kryptiden dein Bündnis anzubieten',kinds:['ball']},
  ausruest:{title:'🎽 AUSRÜSTUNG',sub:'Tragitems – eines pro Kryptide',kinds:['held']}
};
const RELEARN_PRICE=350;

// Was diese Kryptide beim Lehrer lernen kann
function relearnPool(m){
  const set=LEARNSETS[FAMILY_OF[m.id]]||[];
  const ids=[];
  set.forEach(pr=>{
    if(pr[0]<=m.level&&m.moves.indexOf(pr[1])<0&&ids.indexOf(pr[1])<0)ids.push(pr[1]);
  });
  return ids;
}
function scrollPool(m){
  return Object.keys(state.bag).filter(k=>{
    const it=ITEMS[k];
    if(!it||it.kind!=='scroll'||state.bag[k]<=0)return false;
    if(m.moves.indexOf(it.move)>=0)return false;
    return it.forType===null||mTypes(m).indexOf(it.forType)>=0;
  });
}
// Attacke beibringen, ggf. mit Ersetzen-Abfrage
function teachMove(m,moveId,cost,scrollKey){
  const learn=()=>{
    if(cost)state.money-=cost;
    if(scrollKey)useItemCount(scrollKey);
    state._teachAsk=null;renderShop();
    const el=$('shopNote');
    if(el)el.innerHTML=`✓ <b>${mName(m)}</b> beherrscht jetzt <b>${MOVES[moveId].name}</b>!`;
  };
  if(m.moves.length<4){m.moves.push(moveId);learn();return;}
  state._teachAsk={mon:m,move:moveId,cost:cost,scroll:scrollKey};
  renderShop();
}
function openShop(){
  healAll();
  state.px=CITY_DEFS[state.area].doorH[0];state.py=CITY_DEFS[state.area].doorH[1]+1;
  state._shopTab='pflege';state._teachMon=null;state._teachAsk=null;
  renderShop();
  showScreen('shop');
  saveGame(true);
}
function buy(k,n){
  const it=ITEMS[k];
  let bought=0;
  for(let i=0;i<n;i++){
    if(state.money<it.price)break;
    state.money-=it.price;addItem(k,1);bought++;
  }
  renderShop();
  const el=$('shopNote');
  if(el)el.innerHTML=bought
    ? `✓ ${bought}× <b>${it.name}</b> gekauft.`
    : `Nicht genug Münzen für ${it.name}.`;
}
function renderTeacher(){
  const l=$('shopList');l.innerHTML='';
  // Schritt 3: Welche Attacke ersetzen?
  if(state._teachAsk){
    const a=state._teachAsk,m=a.mon;
    const h=document.createElement('div');h.className='sect';
    h.innerHTML=`${mName(m)} kennt schon 4 Attacken – welche ersetzen?`;
    l.appendChild(h);
    m.moves.forEach((mid,i)=>{
      const mo=MOVES[mid];
      const r=document.createElement('div');r.className='row';
      r.innerHTML=`<div class="rn"><span class="badge" style="background:${TYPE_COLORS[mo.type]}">${mo.name}</span>
        <span style="opacity:.75"> · ${mo.power?'St.'+mo.power:'Effekt'} · ${moveAcc(mo)}% · AP ${moveAP(mo)}</span>
        <div style="opacity:.8;margin-top:2px">${moveDesc(mo)}</div></div><div class="chev">›</div>`;
      r.onclick=()=>{
        m.moves[i]=a.move;
        if(a.cost)state.money-=a.cost;
        if(a.scroll)useItemCount(a.scroll);
        state._teachAsk=null;renderShop();
        const el=$('shopNote');
        if(el)el.innerHTML=`✓ <b>${mName(m)}</b> vergisst <b>${mo.name}</b> und lernt <b>${MOVES[a.move].name}</b>!`;
      };
      l.appendChild(r);
    });
    const g=document.createElement('div');g.className='action-grid';
    const c=document.createElement('button');c.textContent='◀ Abbrechen';c.className='secondary span2';
    c.onclick=()=>{state._teachAsk=null;renderShop();};
    g.appendChild(c);l.appendChild(g);
    return;
  }
  // Schritt 2: Attacken für die gewählte Kryptide
  if(state._teachMon!=null&&state.team[state._teachMon]){
    const m=state.team[state._teachMon];
    const h=document.createElement('div');h.className='sect';
    h.innerHTML=`ATTACKEN FÜR ${mName(m).toUpperCase()} · ${typeBadges(m)}`;
    l.appendChild(h);
    const cur=document.createElement('div');
    cur.style.cssText='font-size:10px;opacity:.8;margin-bottom:6px;line-height:1.5';
    cur.innerHTML='<b>Kennt bereits:</b><br>'+mMoves(m).map(x=>
      `${x.name} <span style="opacity:.75">(${x.type} · ${x.power?'St.'+x.power:'Effekt'} · ${moveAcc(x)}% · AP ${moveAP(x)})</span>`
    ).join('<br>');
    l.appendChild(cur);

    const scr=scrollPool(m);
    if(scr.length){
      const sh=document.createElement('div');sh.className='sect';sh.textContent='📜 SCHRIFTROLLEN';
      l.appendChild(sh);
      scr.forEach(k=>{
        const it=ITEMS[k],mo=MOVES[it.move];
        const r=document.createElement('div');r.className='row';
        r.innerHTML=`<div class="rn"><span class="badge" style="background:${TYPE_COLORS[mo.type]}">${mo.name}</span>
          <span style="opacity:.75"> · St.${mo.power} · ${moveAcc(mo)}% · AP ${moveAP(mo)}</span>
          <div style="opacity:.85;margin-top:2px">${moveDesc(mo)}</div>
          <div style="opacity:.6">verbraucht ${it.name}</div></div><div class="chev">›</div>`;
        r.onclick=()=>teachMove(m,it.move,0,k);
        l.appendChild(r);
      });
    }
    const pool=relearnPool(m);
    const rh=document.createElement('div');rh.className='sect';
    rh.textContent='↺ FRÜHERE ATTACKEN · 💰'+RELEARN_PRICE;
    l.appendChild(rh);
    if(!pool.length){
      const p2=document.createElement('div');
      p2.style.cssText='font-size:10.5px;opacity:.7';
      p2.textContent='Diese Kryptide kennt bereits alles, was sie auf ihrem Level lernen kann.';
      l.appendChild(p2);
    }
    pool.forEach(id=>{
      const mo=MOVES[id],afford=state.money>=RELEARN_PRICE;
      const r=document.createElement('div');r.className='row';
      if(!afford)r.style.opacity='.5';
      r.innerHTML=`<div class="rn"><span class="badge" style="background:${TYPE_COLORS[mo.type]}">${mo.name}</span>
        <span style="opacity:.75"> · ${mo.power?'St.'+mo.power:'Effekt'} · ${moveAcc(mo)}% · AP ${moveAP(mo)}</span>
        <div style="opacity:.85;margin-top:2px">${moveDesc(mo)}</div></div><div class="chev">›</div>`;
      r.onclick=()=>{
        if(state.money<RELEARN_PRICE){
          const el=$('shopNote');if(el)el.innerHTML='Nicht genug Münzen.';return;
        }
        teachMove(m,id,RELEARN_PRICE,null);
      };
      l.appendChild(r);
    });
    const g=document.createElement('div');g.className='action-grid';
    const c=document.createElement('button');c.textContent='◀ Andere Kryptide';c.className='secondary span2';
    c.onclick=()=>{state._teachMon=null;renderShop();};
    g.appendChild(c);l.appendChild(g);
    const note=document.createElement('div');note.id='shopNote';
    note.style.cssText='font-size:11px;font-weight:bold;min-height:14px;margin-top:5px';
    l.appendChild(note);
    return;
  }
  // Schritt 1: Kryptide wählen
  const sub=document.createElement('div');
  sub.style.cssText='font-size:10px;opacity:.7;margin-bottom:5px;line-height:1.4';
  sub.innerHTML='Frühere Attacken neu lernen (💰'+RELEARN_PRICE+') oder Schriftrollen einlösen.<br>'+
    'Rollen bekommst du von Gebiets-Bossen – sie passen nur zu Kryptiden ihres Typs.';
  l.appendChild(sub);
  state.team.forEach((m,i)=>{
    const scr=scrollPool(m).length,pool=relearnPool(m).length;
    const{row,cv}=monRow(m,{onClick:()=>{state._teachMon=i;renderShop();}});
    row.querySelector('.rn').insertAdjacentHTML('beforeend',
      `<div style="opacity:.7;font-size:10px">${scr?'📜 '+scr+' Rolle(n) · ':''}${pool} lernbar</div>`);
    l.appendChild(row);monCanvas(cv,m.id,m.shiny);
  });
  const note=document.createElement('div');note.id='shopNote';
  note.style.cssText='font-size:11px;font-weight:bold;min-height:14px;margin-top:5px';
  l.appendChild(note);
}
function renderShop(){
  const tab=state._shopTab||'pflege',T=SHOP_TABS[tab];
  $('shopMoney').innerHTML=
    `<b>⛺ Rasthaus · ${CITY_NAMES[state.area]}</b><br>`+
    `Dein Team wurde geheilt ✓<br>`+
    `💰 <b>${state.money}</b> Münzen`;
  document.querySelectorAll('#shopTabs button').forEach(b=>
    b.classList.toggle('on',b.dataset.shop===tab));
  if(tab==='lehrer')return renderTeacher();
  const l=$('shopList');l.innerHTML='';
  const sub=document.createElement('div');
  sub.style.cssText='font-size:10px;opacity:.7;margin-bottom:5px';
  sub.textContent=T.sub;
  l.appendChild(sub);
  SHOP_STOCK.filter(k=>ITEMS[k]&&T.kinds.indexOf(ITEMS[k].kind)>=0).forEach(k=>{
    const it=ITEMS[k],have=state.bag[k]||0,afford=state.money>=it.price;
    const r=document.createElement('div');r.className='row';r.style.cursor='default';
    r.innerHTML=
      `<div class="rn">
         <b>${it.name}</b> <span style="opacity:.75">· 💰${it.price}</span>
         ${have?`<span class="badge" style="background:#7a7290">im Beutel ${have}</span>`:''}
         <div style="opacity:.8;margin-top:2px">${it.desc}</div>
       </div>`;
    const btns=document.createElement('div');
    btns.style.cssText='display:flex;flex-direction:column;gap:4px;flex:none';
    const b1=document.createElement('button');
    b1.textContent='Kaufen';b1.style.padding='6px 8px';b1.style.fontSize='10px';
    b1.disabled=!afford;b1.onclick=()=>buy(k,1);
    btns.appendChild(b1);
    if(it.kind!=='held'){
      const b5=document.createElement('button');
      b5.textContent='×5';b5.className='secondary';
      b5.style.padding='6px 8px';b5.style.fontSize='10px';
      b5.disabled=state.money<it.price*5;
      b5.onclick=()=>buy(k,5);
      btns.appendChild(b5);
    }
    r.appendChild(btns);
    l.appendChild(r);
  });
  if(tab==='ausruest'){
    const hint=document.createElement('div');
    hint.style.cssText='font-size:10px;opacity:.65;margin-top:4px;line-height:1.4';
    hint.textContent='Anlegen im MENÜ → Kryptide antippen → 🎽 Tragitem.';
    l.appendChild(hint);
  }
  const note=document.createElement('div');
  note.id='shopNote';
  note.style.cssText='font-size:11px;font-weight:bold;min-height:14px;margin-top:5px';
  l.appendChild(note);
}
document.querySelectorAll('#shopTabs button').forEach(b=>{
  b.addEventListener('click',()=>{
    state._shopTab=b.dataset.shop;
    state._teachMon=null;state._teachAsk=null;
    renderShop();
  });
});

// ============================ NAVIGATION ============================
$('btnMenu').addEventListener('click',()=>{
  if(state.mode==='world')showMenu();
  else if(state.mode==='team'||state.mode==='dex'||state.mode==='shop')enterWorld();
});
$('btnBackWorld').addEventListener('click',enterWorld);
$('btnDexBack').addEventListener('click',()=>{state._tab='team';showMenu();});
$('btnShopBack').addEventListener('click',enterWorld);
// Katalog und Beutel liegen jetzt auf den Reitern im Menü
$('btnSave').addEventListener('click',()=>saveGame(false));
$('btnCode').addEventListener('click',()=>{
  $('codeBox').classList.remove('hidden');$('codeArea').value=toCode();
  saveStatus('📋 Tippe auf <b>Kopieren</b> und sichere den Code.');
});
$('btnCodeCopy').addEventListener('click',async()=>{
  const ta=$('codeArea');ta.value=toCode();let ok=false;
  try{if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(ta.value);ok=true;}}catch(e){}
  if(!ok){try{ta.focus();ta.select();ta.setSelectionRange(0,ta.value.length);ok=document.execCommand('copy');}catch(e){}}
  saveStatus(ok?'✓ Code kopiert!':'Bitte Text markieren und manuell kopieren.');
});
$('btnCodeClose').addEventListener('click',()=>$('codeBox').classList.add('hidden'));
$('btnCodeLoad').addEventListener('click',()=>{
  if(fromCode($('codeArea').value)){repairCatalog();showMenu();saveStatus('✓ Spielstand geladen!');}
  else saveStatus('⚠️ Code ungültig.');
});
$('btnTitleCode').addEventListener('click',()=>{$('titleCodeBox').classList.toggle('hidden');$('titleCodeArea').focus();});
$('btnTitleCodeCancel').addEventListener('click',()=>$('titleCodeBox').classList.add('hidden'));
$('btnTitleCodeLoad').addEventListener('click',()=>{
  if(fromCode($('titleCodeArea').value)){state.healed=false;enterWorld();
    toast('✓ Spielstand geladen – willkommen zurück in '+areaDef().name+'!',3200);}
  else $('storageNote').innerHTML='⚠️ Code ungültig – bitte den vollständigen Code einfügen.';
});

// ============================ MENÜ-NAVIGATION PER D-PAD ============================
// Da Wisch-Scrollen in eingebetteten Vorschauen unzuverlässig sein kann, lässt sich
// jedes Menü komplett per D-Pad + Bestätigen/Zurück bedienen (wie bei einem echten Handheld).
let navEl=null;
function navScreenRoot(){
  const map={title:'screen-title',battle:'screen-battle',team:'screen-team',dex:'screen-dex',shop:'screen-shop'};
  const id=map[state.mode];
  if(!id)return null;
  const scr=document.getElementById(id);
  if(!scr)return null;
  const overlay=scr.querySelector('#dexDetail');
  if(overlay&&!overlay.classList.contains('hidden'))return overlay;
  return scr;
}
function navIsVisible(el){
  let cur=el;
  while(cur){
    if(cur.classList&&cur.classList.contains('hidden'))return false;
    if(cur===document.body)break;
    cur=cur.parentElement;
  }
  return true;
}
function navButtons(){
  const npcBox=$('npcBox');
  if(state.mode==='world'&&npcBox&&!npcBox.classList.contains('hidden')){
    return [$('npcNext')].filter(Boolean);
  }
  const root=navScreenRoot();
  if(!root)return [];
  return Array.from(root.querySelectorAll('button')).filter(b=>!b.disabled&&navIsVisible(b));
}
function navSetFocus(el){
  if(navEl&&navEl!==el)navEl.classList.remove('nav-focus');
  navEl=el;
  if(navEl){navEl.classList.add('nav-focus');navEl.scrollIntoView({block:'nearest',behavior:'smooth'});}
}
function navMove(dir){
  const items=navButtons();
  if(!items.length)return;
  let idx=navEl?items.indexOf(navEl):-1;
  idx=idx<0?(dir>0?0:items.length-1):Math.max(0,Math.min(items.length-1,idx+dir));
  navSetFocus(items[idx]);
}
function navConfirm(){
  const items=navButtons();
  if(navEl&&items.includes(navEl)){navEl.click();return;}
  if(items.length)navSetFocus(items[0]);
}
function navCancel(){
  const items=navButtons();
  const back=items.find(b=>(b.textContent||'').trim().startsWith('◀'));
  if(back){back.click();return;}
  const npcBox=$('npcBox');
  if(state.mode==='world'&&npcBox&&!npcBox.classList.contains('hidden')){$('npcNext').click();}
}

const DIRS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
document.querySelectorAll('.dpad [data-dir]').forEach(btn=>{
  let rep=null;const d=DIRS[btn.dataset.dir];
  const step=()=>{
    if(state.mode==='world')movePlayer(d[0],d[1]);
    else navMove(d[1]!==0?d[1]:d[0]);
  };
  btn.addEventListener('pointerdown',e=>{e.preventDefault();step();rep=setInterval(step,165);});
  ['pointerup','pointerleave','pointercancel'].forEach(ev=>btn.addEventListener(ev,()=>{clearInterval(rep);rep=null;}));
});
$('btnConfirm').addEventListener('pointerdown',e=>{
  e.preventDefault();
  if(state.mode==='world'){
    const npcBox=$('npcBox');
    if(npcBox&&!npcBox.classList.contains('hidden')){$('npcNext').click();return;}
    if(!dialogAktiv&&!moveLock){
      const f=state.facing||[0,1];
      const np=npcAt(state.px+f[0],state.py+f[1]);
      if(np)talkTo(np);
    }
  }else navConfirm();
});
$('btnCancel').addEventListener('pointerdown',e=>{
  e.preventDefault();
  navCancel();
});
document.addEventListener('keydown',e=>{
  const map={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right',W:'up',S:'down',A:'left',D:'right'};
  const dd=map[e.key];
  if(dd){
    if(state.mode==='world'){e.preventDefault();movePlayer(DIRS[dd][0],DIRS[dd][1]);}
    else{e.preventDefault();navMove(DIRS[dd][1]!==0?DIRS[dd][1]:DIRS[dd][0]);}
  }
  if(e.key==='Enter'){e.preventDefault();
    if(state.mode==='world'){
      const npcBox=$('npcBox');
      if(npcBox&&!npcBox.classList.contains('hidden'))$('npcNext').click();
    }else navConfirm();
  }
  if(e.key==='Escape'||e.key==='m'){
    if(state.mode==='world')showMenu();
    else if(state.mode!=='battle'&&state.mode!=='title'&&state.mode!=='intro')enterWorld();
  }
});
let ts=null;
$('worldCanvas').addEventListener('touchstart',e=>{ts={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
$('worldCanvas').addEventListener('touchend',e=>{
  if(!ts)return;const dx=e.changedTouches[0].clientX-ts.x,dy=e.changedTouches[0].clientY-ts.y;ts=null;
  if(Math.abs(dx)<16&&Math.abs(dy)<16)return;
  if(Math.abs(dx)>Math.abs(dy))movePlayer(dx>0?1:-1,0);else movePlayer(0,dy>0?1:-1);
},{passive:true});

showScreen('intro');
window.__booted=true;
Promise.resolve().then(startIntro).catch(e=>window.__showFatal('Intro: '+(e&&e.message?e.message:e),false));

}catch(err){
  window.__showFatal((err&&err.message?err.message:err)+(err&&err.stack?'\n'+err.stack:''),true);
}
})();
