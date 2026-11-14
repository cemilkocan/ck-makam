/* CK Makam - free browser music maker for Turkish makam music.
   Everything runs locally: Web Audio playback, loop recording, MP3/WAV/stem export. */
"use strict";

/* ---------- data ---------- */

// Measured fundamental frequency (Hz) of each bağlama sample (YIN, 48 kHz).
const BAGLAMA_F0 = {
  gl: 98.26, abl: 104.51, ab2l: 107.37, a: 110.26, bb2: 120.59, eb2: 160.57,
  e: 165.29, f: 174.28, fsharp3: 180.34, fsharp: 185.67, g: 195.87, ab: 208.17,
  cs: 209.23, ab2: 213.38, ah: 220.36, bbh: 233.47, bb: 234.8, bb2h: 240.27,
  b: 247.67, bh: 248.06, c: 261.95, ch: 262.89, cs3: 270.73, cs3h: 280.94,
  csh: 289.17, d1n: 293.94, dh: 299.11, eb: 312.66, ebh: 314.09, eh: 334.27
};

// Scale degrees measured from the SymbTr corpus (40-60 pieces per makam) rather than
// copied from the AEU table, so they follow what players actually play.
const MAKAMS = {
  "Hicaz":     { steps: [5, 12, 5, 9, 4, 9, 9], mood: "sad" },
  "Rast":      { steps: [9, 8, 5, 9, 9, 8, 5], mood: "happy" },
  "Uşşak":     { steps: [7, 6, 9, 9, 4, 9, 9], mood: "calm" },
  "Kürdi":     { steps: [4, 9, 9, 9, 4, 9, 9], mood: "sad" },
  "Hüzzam":    { steps: [5, 9, 6, 10, 6, 9, 8], mood: "sad" },
  "Nihavent":  { steps: [9, 4, 9, 9, 4, 9, 9], mood: "sad" },
  "Hüseyni":   { steps: [7, 6, 9, 9, 4, 9, 9], mood: "happy" },
  "Mahur":     { steps: [9, 9, 4, 9, 9, 9, 4], mood: "happy" },
  "Muhayyer":  { steps: [7, 6, 9, 9, 7, 6, 9], mood: "happy" },
  "Saba":      { steps: [7, 6, 6, 12, 4, 9, 9], mood: "sad" },
  "Beyati":    { steps: [7, 6, 9, 9, 4, 9, 9], mood: "calm" },
  "Neva":      { steps: [7, 6, 9, 9, 8, 5, 9], mood: "calm" },
  "Çargah":    { steps: [9, 9, 4, 9, 9, 9, 4], mood: "happy" }
};

const TONICS = [["G", 196.00], ["G#", 207.65], ["A", 220.00], ["A#", 233.08],
                ["B", 246.94], ["C", 261.63], ["C#", 277.18], ["D", 293.66],
                ["D#", 311.13], ["E", 329.63], ["F", 349.23], ["F#", 369.99]];

// Camelot codes. Minor-leaning makams sit on the A ring, major-leaning ones on B.
const CAMELOT_A = { "G#": 1, "D#": 2, "A#": 3, F: 4, C: 5, G: 6, D: 7, A: 8, E: 9, B: 10, "F#": 11, "C#": 12 };
const CAMELOT_B = { B: 1, "F#": 2, "C#": 3, "G#": 4, "D#": 5, "A#": 6, F: 7, C: 8, G: 9, D: 10, A: 11, E: 12 };
const A_ROOT = Object.fromEntries(Object.entries(CAMELOT_A).map(([k, v]) => [v, k]));
const B_ROOT = Object.fromEntries(Object.entries(CAMELOT_B).map(([k, v]) => [v, k]));

const DRUM_ROWS = ["doum", "tek", "tekhi", "slap", "mid", "mute",
                   "davul_dum", "davul_tek", "kudum_dum", "kudum_tek",
                   "bendir", "zil", "tef", "kasik", "snare", "clap"];

// Usul presets. steps = cells per bar, quarters = bar length in quarter notes,
// groups = cells per beat. Patterns: X strong, x normal, o soft, . off.
const USULS = {
  "Maqsum (4/4)": { steps: 8, quarters: 4, groups: [2, 2, 2, 2],
    rows: { doum: "X...x...", tek: ".x.x..x." } },
  "Ayyub (2/4)": { steps: 8, quarters: 2, groups: [4, 4],
    rows: { doum: "X...x...", mute: "...o....", tek: "......x." } },
  "Çiftetelli (4/4)": { steps: 16, quarters: 4, groups: [4, 4, 4, 4],
    rows: { doum: "X.......x.x.....", tek: "...x..x.....x..." } },
  "Sofyan (4/4)": { steps: 8, quarters: 4, groups: [2, 2, 2, 2],
    rows: { doum: "X.......", tek: "..x.x..." } },
  "Nîmsofyan (2/4)": { steps: 4, quarters: 2, groups: [2, 2],
    rows: { doum: "X...", tek: "..x." } },
  "Karşılama (9/8)": { steps: 9, quarters: 4.5, groups: [2, 2, 2, 3],
    rows: { doum: "X...x....", tek: "..x...x.x" } },
  "Aksak (9/8)": { steps: 9, quarters: 4.5, groups: [2, 2, 2, 3],
    rows: { doum: "X.....X..", tek: "..x.x...x" } },
  "Düyek (8/8)": { steps: 8, quarters: 4, groups: [2, 2, 2, 2],
    rows: { doum: "X...X...", tek: "...x..x." } },
  "Boş (4/4)": { steps: 16, quarters: 4, groups: [4, 4, 4, 4], rows: {} }
};

const SOUND_FILES = (() => {
  const m = {};
  for (const k of Object.keys(BAGLAMA_F0)) m["bag_" + k] = "sounds/baglama/" + k + ".mp3";
  for (const s of ["doum", "tek", "tekhi", "mid", "mute"]) m[s] = "sounds/darbuka/" + s + ".wav";
  for (const s of ["davul_dum", "davul_tek", "kudum_dum", "kudum_tek", "bendir",
                   "zil", "tef", "kasik", "slap", "snare", "clap"])
    m[s] = "sounds/drums/" + s + ".wav";
  return m;
})();

/* ---------- language ---------- */

const I18N = {
  tr: {
    play: "Çal", stop: "Dur", usul: "Usul", bars: "Ölçü", clear: "Temizle", vol: "Ses",
    swing: "Salınım", theme: "Tema", collapse: "Gizle", expand: "Göster",
    makam: "Makam", tonic: "Karar", strings: "Tel", metal: "Metal tel", plastic: "Plastik tel",
    smart: "Akıllı dizi",
    smartHelp: "Açıkken dizi dışı tuşlar en yakın makam perdesine kayar, yanlış nota çalamazsın. Kapatırsan klavye tam kromatik olur, diyezler kendi sesini verir.",
    record: "Kayıt", recording: "Kaydediyor", quantize: "Gride yapış", undo: "Geri al",
    notes: "nota", export: "İndir", loops: "Tekrar", save: "Projeyi kaydet", load: "Proje aç",
    video: "Dikey video", share: "Paylaşım linki", linkCopied: "Link kopyalandı, yapıştırıp paylaşabilirsin.",
    linkFail: "Link kopyalanamadı, adres çubuğundan alabilirsin.", linkLoaded: "Paylaşılan loop açıldı.",
    videoRec: "Video çekiliyor, bitene kadar bekle...", videoNo: "Bu tarayıcı video kaydını desteklemiyor, Chrome dene.",
    rendering: "Hazırlanıyor...", encoding: "MP3 kodlanıyor...", packing: "Paketleniyor...",
    done: "Bitti.", failed: "Hata: ", loaded: "Proje yüklendi.",
    strong: "Güçlü", normal: "Normal", soft: "Hafif", off: "Boş",
    strongT: "Vurgulu, en sert vuruş", normalT: "Normal vuruş", softT: "Kısık, yumuşak vuruş", offT: "Sessiz",
    muteTip: "Tıkla: bu satırı sustur veya aç",
    rollHint: "Boş yere tıkla, nota ekle. Notayı sürükleyerek yerini değiştir. Sağ tık siler.",
    gridHint: "Hücreye tıkla: normal, güçlü, hafif, boş. Sağ tık doğrudan susturur. Satır adına tıklamak o çalgıyı susturur.",
    midi: "MIDI bağla", midiDevice: "Cihaz", midiNone: "MIDI cihazı bulunamadı",
    midiNo: "Bu tarayıcı MIDI desteklemiyor, Chrome ya da Edge dene",
    midiDenied: "MIDI izni verilmedi. Adres çubuğundaki kilit simgesinden izni açıp tekrar dene.",
    kbHint: "Bilgisayardan çal: A S D F G H J K L tuşları beyaz, W E T Y U O P siyah perdeler. Z X C V B N M darbuka. Boşluk çal/dur.",
    rotate: "Daha geniş çalışmak için telefonu yan çevir.",
    credits: "Emeği geçenler",
    creditsBody: '<a href="https://cemilkocan.com">Cemil Koçan</a> yaptı. Kulağı ve önerileri için Samet Yenipınar\'a (<a href="https://www.youtube.com/@art-s-y">ARTSY</a>) teşekkürler.',
    tagline: "Ücretsiz. Her şey tarayıcında çalışır, hiçbir veri gönderilmez.",
    noteNames: ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"],
    moods: { happy: "neşeli", sad: "hüzünlü", calm: "sakin" },
    drums: { doum: "Düm", tek: "Tek", tekhi: "Tek tiz", slap: "Slap", mid: "Orta", mute: "Ka",
      davul_dum: "Davul düm", davul_tek: "Davul çubuk",
      kudum_dum: "Kudüm düm", kudum_tek: "Kudüm tek", bendir: "Bendir",
      zil: "Zil", tef: "Tef", kasik: "Kaşık", snare: "Trampet", clap: "Alkış" },
    usulInfo: {
      "Maqsum (4/4)": "Arap ve Türk popunun en çok duyulan ritmi. Düm tek tek, düm tek. Oynak ve tanıdık.",
      "Ayyub (2/4)": "Hızlı dönen iki zamanlı kalıp. Göbek dansında ve sufi müziğinde duyarsın.",
      "Çiftetelli (4/4)": "Düğün ritmi. Vuruşlar aralıklı, salınan bir his verir.",
      "Sofyan (4/4)": "Dört zamanlı en sade usul. Yeni başlayan için iyi bir zemin.",
      "Karşılama (9/8)": "Trakya'nın dokuz zamanlısı. 2+2+2+3 sayılır, son grup uzundur.",
      "Aksak (9/8)": "Halk müziğinin temel aksak kalıbı. 2+2+2+3, topallayan bir yürüyüş gibi.",
      "Düyek (8/8)": "Fasıl ve ilahilerde çok kullanılan sekiz zamanlı usul. Ağır ve oturaklı.",
      "Boş (4/4)": "Hiçbir vuruş yok. Kendi ritmini sıfırdan kurmak için."
    },
    makamInfo: {
      "Hicaz": "Hüzünlü ve doğulu. İkinci perde pes, üçüncü perde tiz; aradaki geniş aralık onu tanınır kılar.",
      "Rast": "Neşeli ve kararlı. Batı majörüne en yakın makam, üçüncü ve yedinci perdeler biraz pes.",
      "Çargah": "Açık ve neşeli. Batı majör dizisinin tam karşılığı, kulağa en alışık gelen makam.",
      "Uşşak": "Sakin ve içli. Türk halk müziğinin en çok kullanılan dizisi.",
      "Kürdi": "Üzgün ve yalın. İkinci perde pes olduğu için baştan koyu bir renk verir.",
      "Hüzzam": "Dokunaklı, kıvrımlı. Hicaz'a benzer ama karar sesi başka yerde durur.",
      "Nihavent": "Romantik ve üzgün. Batı minörünün karşılığı, modern düzenlemelerle en kolay birleşen makam.",
      "Hüseyni": "Canlı ve yiğit. Anadolu türkülerinin en geniş kullanılan dizilerinden.",
      "Mahur": "Parlak ve tok. Batı majörüne yakın durur, kararlı bir hava verir.",
      "Muhayyer": "Hareketli ve tiz. Yukarıdan başlayıp aşağı doğru akar.",
      "Saba": "En hüzünlü makam sayılır. Dördüncü perdesi beklenmedik yere düşer, içi burkar.",
      "Beyati": "Sakin ve yumuşak. Uşşak'a yakın ama daha oturaklı.",
      "Neva": "Dingin ve dengeli. Marşlarda ve ağır türkülerde çok duyulur."
    },
    wheelNote: "Dikkat: Camelot, Batı'nın 12 eşit aralıklı sistemine göre kuruludur. Makamın koma perdeleriyle matematiği farklıdır, bu tekerlek komalı geçişleri birebir karşılamaz. Yaklaşık bir pusula olarak kullan.",
    bpmLbl: "BPM",
    rhythm: "Ritim", inst: "Çalgı", baglama: "Bağlama", kanun: "Kanun", ney: "Ney",
    upload: "Müzik yükle", toNotes: "Notaya çevir", analysing: "Melodi çözülüyor...",
    notesFound: "nota çıkarıldı", noMelody: "Tek sesli bir melodi bulunamadı. Mırıldanma ya da tek çalgı kaydı en iyi sonucu verir.",
    fileLoaded: "Dosya yüklendi,", fileBad: "Bu dosya okunamadı.",
    uploadHint: "Kendi mp3 ya da wav dosyanı yükleyip katman olarak kullanabilirsin. Notaya çevir, tek sesli kayıtlarda çalışır: mırıldanma, tek bir çalgı ya da solo vokal. Karışık bir şarkıyı enstrümanlarına ayırmaz, onu tarayıcıda yapmak mümkün değil.",
    uploadHelp: "Notaya çevir tek sesli kayıtlarda çalışır, yani aynı anda tek bir perde duyulan kayıtlarda.\n\nEn iyi sonucu verenler:\n• Kendi mırıldanman ya da ıslığın. Telefonla sessiz bir odada kaydet, on on beş saniye yeter.\n• Tek bir çalgının solo kaydı: bağlama, ney, keman, flüt, piyano tek elle.\n• Araya çalgı karışmayan solo vokal.\n\nÇalışmayan: tam bir şarkı kaydı. Davul, bas ve birkaç çalgı aynı anda çalarken hangi sesin melodi olduğu ayırt edilemez, ortaya rastgele notalar çıkar. Karışık bir kaydı enstrümanlarına ayırmak ayrı bir iştir ve tarayıcıda yapılamaz.\n\nKayıt ipuçları: arkada televizyon, klima ya da sokak sesi olmasın. Mikrofona çok yaklaşma, patlama sesleri perdeyi bozar. Tempoyu önce uygulamada ayarla; loop çalarken mırıldanırsan notalar doğru yere oturur. mp3, wav, m4a ve ogg okunur.\n\nSon olarak: başkasının şarkısını indirip kullanmak hem eser sahibinin hakkına girer hem de çoğu sitenin kurallarına aykırıdır. Kendi sesin ya da kendi çaldığın kayıt hem en doğru sonucu verir hem de sorunsuzdur. Hazır ses arıyorsan Freesound'un CC0 bölümüne bak.",
    fileTitle: "Dosyadan çıkar", pickFile: "Dosya seç", getRhythm: "Ritmi çıkar",
    getMelody: "Melodiyi çıkar", asLayer: "Katman yap", reading: "Dosya okunuyor...",
    hitsFound: "vuruş yerleşti", noRhythm: "Belirgin bir ritim bulunamadı.",
    fileHint: "mp3, wav, m4a, opus, ogg, aac, flac ve mp4 okunur. Ritmi çıkar tam şarkılarda da çalışır: tempoyu bulur, vuruşları bandlarına göre düm, tek ve tek tiz satırlarına dağıtır. Melodiyi çıkar yalnızca tek sesli kayıtlarda işe yarar.",
    demo: "Demo", demoPick: "Bir türkü seç", demoLoaded: "Türkü yüklendi, Çal'a bas.",
    mic: "Sesini kaydet", micRec: "Kaydı durdur", micClear: "Sesi sil",
    micOffset: "Kaydırma", fxReverb: "Yankı", fxEcho: "Eko", fxChorus: "Koro", fxDrive: "Bozulma",
    fxBass: "Kalınlık", fxTreble: "Tizlik", fxComp: "Sıkıştır", fxPhone: "Telefon", fxReset: "Efektleri sıfırla",
    micHint: "Mikrofona konuş ya da söyle, sesin loop'a katman olarak eklenir. Çal sırasında kaydedersen ritme oturur. Geç ya da erken düştüyse kaydırmayla hizala. Hoparlör açıkken kaydedersen loop sesi de karışabilir, kulaklık takmak en temizi.",
    micDenied: "Mikrofon izni verilmedi.", micNo: "Bu tarayıcı mikrofon kaydını desteklemiyor.",
    micEmpty: "Kayıt boş çıktı, tekrar dene.", micOn: "Kaydediyor, bitince düğmeye bas.", micSaved: "Ses eklendi.", voice: "Ses",
    wheel: "Camelot tekerleği", wheelNow: "Şu an", wheelFit: "Uyumlu",
    wheelHelp: "Tekerlekten bir koda tıklayınca karar sesi ve makam ona göre ayarlanır. Aşağıdaki açıklamada sistemin nasıl çalıştığı yazıyor.",
    learn: "Bunlar ne demek?",
    learnCamelot: "Camelot, tonları numara ve harfle adlandıran bir sistem. Numara sesin çemberdeki yerini, harf de rengini gösteriyor: A koyu (minör) taraf, B açık (majör) taraf. 8A la minör demek, 8B do majör demek.\n\nİşe yarar yanı şu: kendi kodunun yanındaki iki numara ve aynı numaranın diğer harfi, seninkiyle neredeyse aynı notaları paylaşır. 8A çalıyorsan 7A, 9A ve 8B'ye geçmek kulağı tırmalamaz. DJ'ler iki şarkıyı birleştirirken bunu kullanıyor ama tek bir parçanın içinde bölümden bölüme geçerken de aynısı geçerli. Türkiye'de pek bilinmiyor, oysa akordeon gibi basit bir pusula.\n\nİki hamle daha var, tekerlek göstermez: yarım ses yukarı çıkmak enerjiyi yükseltir, nakarat öncesi çok kullanılır. Aynı kökü koruyup majörden minöre düşmek de kulakta doğal durur, çünkü karar sesi değişmez.",
    learnKoma: "Batı müziğinde oktav 12 eşit yarım sese bölünür, piyanonun tuşları bunlardır. Türk makam müziğinde kullanılan Arel-Ezgi-Uzdilek sisteminde ise oktav 53 parçaya bölünür, her birine koma denir. Bir tam ses 9 koma, yarım ses dediğimiz aralık 4 ya da 5 koma tutar.\n\nBunun sonucu şu: piyanonun iki tuşu arasına düşen, tuşu olmayan sesler vardır. Makamı makam yapan perdeler çoğunlukla oralardadır. Hicaz'ın ikinci perdesi hiçbir piyano tuşuna oturmaz. Bağlamanın gitardan çok daha fazla perdesi olmasının sebebi de budur.\n\nNeden 53? Saf beşli aralığını üst üste eklersen 53 adım sonra neredeyse tam olarak başladığın sesin oktavına düşersin. Yani 53, saf aralıklara 12'den çok daha yakın oturan bir cetveldir.\n\nAma şunu net söylemek gerek: 53 de bir yuvarlamadır. Batı 12'ye yuvarlamış, AEU 53'e yuvarlamıştır, ikisi de teorik modeldir. Hiçbir icracı cetveldeki komaya tam basmaz. Perdeler yöreye, icracıya, hatta ezginin çıkarken mi inerken mi olduğuna göre esner. Segah ve eviç bunun klasik örnekleridir; gerçek kayıtlar üzerinde yapılan ölçümler AEU'nun öngördüğü yerlere oturmaz. Zaten tek sistem de değildir: Rauf Yekta 24'lük, Ekrem Karadeniz 41'lik bölünme önermiştir.\n\nBağlamada 53 perde yoktur, bir oktavda aşağı yukarı 17 ile 24 arası perde bulunur. 53 koma çalgının perde sayısı değil, ölçü birimidir.\n\nBu uygulama AEU'yu kullanıyor çünkü en yaygın öğretilen cetvel bu. Yani buradaki perdeleri başlangıç noktası say, mutlak doğru değil. Kulağın başka bir yer söylüyorsa kulağın haklıdır.",
    learnKomaT: "Koma perde nedir?", learnCamelotT: "Camelot nasıl okunur?",
    makamUse: {
      "Hicaz": "Arabesk, ağır romantik parçalar, dramatik giriş bölümleri. Özlem ve ayrılık anlatmak için.",
      "Rast": "Açılış parçaları, yürüyen ve umut veren bölümler. Dinleyiciyi yormaz, uzun çalınır.",
      "Çargah": "Çocuk şarkıları, marşlar, neşeli ve basit melodiler. Batı kulağına en yakın duran makam.",
      "Uşşak": "Türküler, ninni ve ağıt arası sakin ezgiler. İçini dökerken kullanılır.",
      "Kürdi": "Hüzünlü ama yalın parçalar. Az notayla çok şey anlatmak isteyen için uygun.",
      "Hüzzam": "Duygusal doruk noktaları, taksim ve uzun soluklu şarkılar. Dokunaklı anlar için.",
      "Nihavent": "Romantik şarkılar, film müziği, modern düzenlemeler.",
      "Hüseyni": "Oyun havaları, yiğitlik türküleri, canlı ve hareketli parçalar.",
      "Mahur": "Kararlı ve parlak açılışlar, marş havası isteyen bölümler.",
      "Muhayyer": "Hızlı oyun havaları, tiz başlayan neşeli ezgiler.",
      "Saba": "En koyu hüzün. Ağıt, ayrılık ve dinî eserler.",
      "Beyati": "Sakin türküler, ninniler, oturaklı ezgiler.",
      "Neva": "Marşlar, ağır ve ciddi parçalar."
    },
    tourTitle: "CK Makam'a hoş geldin",
    tourSkip: "Atla", tourNext: "İleri", tourPrev: "Geri", tourDone: "Başla",
    tour: [
      ["Çal düğmesi", "Yeşil düğmeye bas, hazır bir darbuka ritmi dönmeye başlar. Tempoyu yanındaki BPM ile değiştirirsin."],
      ["Ritmi değiştir", "Karelere tıkla. Her tıklamada normal, güçlü, hafif ve boş arasında döner. Sağ tık doğrudan susturur. Soldaki çalgı adına tıklarsan o satır komple susar."],
      ["Usul seç", "Maqsum, Çiftetelli, Karşılama gibi hazır kalıplar var. Yanındaki soru işaretine basarsan her birinin ne olduğunu okursun."],
      ["Makam ve bağlama", "Makam seçip piyanodan çal. Akıllı dizi açıkken yanlış nota basamazsın, her tuş makamın perdesine oturur."],
      ["Nota kaydet", "Çal derken Kayıt'a bas ve piyanodan çal. Çaldığın notalar üstteki piyano roll'a düşer. Oradan sürükleyip yerini değiştirir, sağ tıkla silersin."],
      ["İndir", "Bitince MP3, WAV ya da her çalgı ayrı dosya olacak şekilde stems indir. Projeni kaydedip sonra kaldığın yerden devam da edebilirsin."]
    ]
  },
  en: {
    play: "Play", stop: "Stop", usul: "Usul", bars: "Bars", clear: "Clear", vol: "Vol",
    swing: "Swing", theme: "Theme", collapse: "Hide", expand: "Show",
    makam: "Makam", tonic: "Tonic", strings: "Strings", metal: "Metal strings", plastic: "Plastic strings",
    smart: "Smart scale",
    smartHelp: "When on, out-of-scale keys snap to the nearest makam pitch, so you cannot play a wrong note. Turn it off for a fully chromatic keyboard where sharps play their own pitch.",
    record: "Record", recording: "Recording", quantize: "Snap to grid", undo: "Undo",
    notes: "notes", export: "Export", loops: "Loops", save: "Save project", load: "Open project",
    video: "Vertical video", share: "Share link", linkCopied: "Link copied, paste it anywhere to share.",
    linkFail: "Could not copy the link, take it from the address bar.", linkLoaded: "Shared loop opened.",
    videoRec: "Recording the video, hold on...", videoNo: "This browser cannot record video, try Chrome.",
    rendering: "Rendering...", encoding: "Encoding MP3...", packing: "Packing...",
    done: "Done.", failed: "Error: ", loaded: "Project loaded.",
    strong: "Strong", normal: "Normal", soft: "Soft", off: "Off",
    strongT: "Accented, hardest stroke", normalT: "Normal stroke", softT: "Muted, gentle stroke", offT: "Silent",
    muteTip: "Click to mute or unmute this row",
    rollHint: "Click an empty spot to add a note. Drag a note to move it. Right-click deletes it.",
    gridHint: "Click a cell to cycle normal, strong, soft, off. Right-click silences it outright. Click a row name to mute that drum.",
    midi: "Connect MIDI", midiDevice: "Device", midiNone: "No MIDI device found",
    midiNo: "This browser has no MIDI support, try Chrome or Edge",
    midiDenied: "MIDI permission was refused. Allow it from the lock icon in the address bar and try again.",
    kbHint: "Play from the computer: A S D F G H J K L are white keys, W E T Y U O P are black. Z X C V B N M hit the drums. Space starts and stops.",
    rotate: "Turn the phone sideways for more room.",
    credits: "Credits",
    creditsBody: 'Made by <a href="https://cemilkocan.com">Cemil Koçan</a>. Thanks to Samet Yenipınar (<a href="https://www.youtube.com/@art-s-y">ARTSY</a>) for his ears and advice.',
    tagline: "Free. Everything runs in your browser, nothing is uploaded.",
    noteNames: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
    moods: { happy: "bright", sad: "melancholic", calm: "calm" },
    drums: { doum: "Dum", tek: "Tek", tekhi: "Tek hi", slap: "Slap", mid: "Mid", mute: "Ka",
      davul_dum: "Davul low", davul_tek: "Davul stick",
      kudum_dum: "Kudüm low", kudum_tek: "Kudüm high", bendir: "Bendir",
      zil: "Zil", tef: "Tef", kasik: "Spoons", snare: "Snare", clap: "Clap" },
    usulInfo: {
      "Maqsum (4/4)": "The most common rhythm in Arabic and Turkish pop. Dum tek tek, dum tek. Bouncy and familiar.",
      "Ayyub (2/4)": "A fast turning two-beat pattern, heard in belly dance and sufi music.",
      "Çiftetelli (4/4)": "The wedding rhythm. Spaced-out strokes with a swaying feel.",
      "Sofyan (4/4)": "The simplest four-beat usul. A good starting point.",
      "Karşılama (9/8)": "The nine-beat rhythm of Thrace, counted 2+2+2+3 with a long last group.",
      "Aksak (9/8)": "The core limping folk pattern, 2+2+2+3, like a walk with a hitch in it.",
      "Düyek (8/8)": "An eight-beat usul common in classical and devotional music. Steady and grounded.",
      "Boş (4/4)": "Empty grid. Build your own rhythm from scratch."
    },
    makamInfo: {
      "Hicaz": "Melancholic and eastern. The flat second and raised third leave a wide gap that makes it instantly recognisable.",
      "Rast": "Bright and settled. The closest makam to a Western major scale, with a slightly lower third and seventh.",
      "Çargah": "Open and cheerful. The exact equivalent of the Western major scale.",
      "Uşşak": "Calm and inward. The most used scale in Turkish folk music.",
      "Kürdi": "Sad and plain. The flat second gives it a dark colour from the first note.",
      "Hüzzam": "Poignant and winding. Close to Hicaz but it comes to rest elsewhere.",
      "Nihavent": "Romantic and sad, the equivalent of the Western minor and the easiest to pair with modern arrangements.",
      "Hüseyni": "Lively and bold, one of the most used scales in Anatolian folk song.",
      "Mahur": "Bright and full, close to a Western major with a settled feel.",
      "Muhayyer": "Animated and high, it starts up top and flows downward.",
      "Saba": "Often called the saddest makam. Its fourth degree falls somewhere you do not expect.",
      "Beyati": "Calm and soft, close to Uşşak but more grounded.",
      "Neva": "Still and balanced, heard in marches and slow folk songs."
    },
    wheelNote: "Note: Camelot is built on the West's 12 equal divisions. Makam comma pitches follow different arithmetic, so this wheel does not map comma-based transitions one to one. Use it as a rough compass.",
    bpmLbl: "BPM",
    rhythm: "Rhythm", inst: "Instrument", baglama: "Bağlama", kanun: "Kanun", ney: "Ney",
    upload: "Load audio", toNotes: "Find the melody", analysing: "Reading the melody...",
    notesFound: "notes found", noMelody: "No single-voice melody found. Humming or one instrument works best.",
    fileLoaded: "File loaded,", fileBad: "That file could not be read.",
    uploadHint: "Load your own mp3 or wav and use it as a layer. Find the melody works on single-voice material: humming, one instrument, or a solo vocal. It does not split a finished song into its instruments, which a browser cannot do.",
    uploadHelp: "Find the melody works on single-voice material, where only one pitch sounds at a time.\n\nWhat works best:\n• Your own humming or whistling. A phone in a quiet room, ten or fifteen seconds is plenty.\n• One instrument on its own: bağlama, ney, violin, flute, piano with one hand.\n• A solo vocal with no instruments behind it.\n\nWhat does not work: a finished song. With drums, bass and several instruments at once there is no way to tell which pitch is the melody, and you get nonsense notes. Splitting a mixed recording into its instruments is a different job and a browser cannot do it.\n\nRecording tips: no television, air conditioning or street noise behind you. Do not crowd the mic, plosives ruin the pitch. Set the tempo first; if you hum while the loop plays, the notes land in the right place. mp3, wav, m4a and ogg are read.\n\nOne last thing: taking somebody else's song and uploading it goes against the rights of whoever made it and against most sites' terms. Your own voice or your own playing gives the better result anyway. For ready-made audio, look at the CC0 section of Freesound.",
    fileTitle: "Take it from a file", pickFile: "Choose a file", getRhythm: "Find the rhythm",
    getMelody: "Find the melody", asLayer: "Use as a layer", reading: "Reading the file...",
    hitsFound: "hits placed", noRhythm: "No clear rhythm found.",
    fileHint: "mp3, wav, m4a, opus, ogg, aac, flac and mp4 are read. Find the rhythm works on full songs: it finds the tempo and sorts the hits into the dum, tek and tek hi rows by frequency band. Find the melody only works on single-voice material.",
    demo: "Demo", demoPick: "Pick a folk song", demoLoaded: "Folk song loaded, press Play.",
    mic: "Record your voice", micRec: "Stop recording", micClear: "Delete voice",
    micOffset: "Nudge", fxReverb: "Reverb", fxEcho: "Echo", fxChorus: "Chorus", fxDrive: "Drive",
    fxBass: "Bass", fxTreble: "Treble", fxComp: "Compress", fxPhone: "Telephone", fxReset: "Reset effects",
    micHint: "Speak or sing into the mic and your voice joins the loop as a layer. Record while it plays and it lands in time. If it sits late or early, nudge it into place. Recording with the speakers on can bleed the loop into the take, so headphones are cleanest.",
    micDenied: "Microphone permission was refused.", micNo: "This browser cannot record from the microphone.",
    micEmpty: "The take came out empty, try again.", micOn: "Recording, press the button when you are done.", micSaved: "Voice added.", voice: "Voice",
    wheel: "Camelot wheel", wheelNow: "Now", wheelFit: "Mixes with",
    wheelHelp: "Click a code and the tonic and makam follow it. The notes below explain how the system works.",
    learn: "What do these mean?",
    learnCamelot: "Camelot names keys with a number and a letter. The number is the position on the circle, the letter is the colour: A is the dark side (minor), B the bright side (major). 8A is A minor, 8B is C major.\n\nWhy it helps: the two numbers either side of yours, and the other letter on your own number, share almost all their notes with you. If you are on 8A, moving to 7A, 9A or 8B will not jar. DJs use it to blend two tracks, but the same holds inside one piece when you move from section to section.\n\nTwo more moves the wheel does not show: going up a semitone lifts the energy, which is why it turns up before a chorus. Keeping the same root and dropping from major to minor also sounds natural, because the home note never moves.",
    learnKoma: "In Western music the octave is split into 12 equal semitones, the keys of a piano. In the Arel-Ezgi-Uzdilek system used for Turkish makam music the octave is split into 53 parts called commas. A whole tone is 9 commas, what we call a semitone is 4 or 5.\n\nThe result: there are pitches that fall between two piano keys, with no key of their own. The notes that make a makam what it is usually live there. The second degree of Hicaz lands on no piano key at all. This is also why a bağlama has far more frets than a guitar.\n\nWhy 53? Stack pure fifths and after 53 steps you land almost exactly on the octave of where you started. So 53 sits far closer to pure intervals than 12 does.\n\nBut this needs saying plainly: 53 is a rounding too. The West rounded to 12, AEU rounded to 53, and both are theoretical models. No performer lands exactly on a comma. Pitches flex by region, by player, even by whether the line is rising or falling. Segah and eviç are the classic cases: measurements of real recordings do not sit where AEU predicts. Nor is it the only system. Rauf Yekta proposed 24 divisions, Ekrem Karadeniz 41.\n\nA bağlama does not have 53 frets. It carries roughly 17 to 24 per octave. The 53 commas are a unit of measurement, not a fret count.\n\nThis app uses AEU because it is the grid most widely taught. Treat the pitches here as a starting point, not the final word. If your ear says somewhere else, your ear is right.",
    learnKomaT: "What is a comma pitch?", learnCamelotT: "How do you read Camelot?",
    makamUse: {
      "Hicaz": "Arabesque, slow romantic songs, dramatic openings. For longing and parting.",
      "Rast": "Opening pieces, walking and hopeful sections. Easy on the ear over a long stretch.",
      "Çargah": "Children's songs, marches, simple cheerful tunes. The closest to a Western ear.",
      "Uşşak": "Folk songs, somewhere between a lullaby and a lament. For quiet confession.",
      "Kürdi": "Sad but plain pieces. Good when you want to say a lot with few notes.",
      "Hüzzam": "Emotional peaks, taksim improvisations, long songs. For the moments that ache.",
      "Nihavent": "Romantic songs, film music, modern arrangements.",
      "Hüseyni": "Dance tunes, songs of bravado, lively material.",
      "Mahur": "Settled, bright openings and anything that wants a march feel.",
      "Muhayyer": "Fast dance tunes and cheerful lines that start high.",
      "Saba": "The deepest grief: laments, partings and devotional pieces.",
      "Beyati": "Calm folk songs, lullabies, grounded melodies.",
      "Neva": "Marches and slow, serious pieces."
    },
    tourTitle: "Welcome to CK Makam",
    tourSkip: "Skip", tourNext: "Next", tourPrev: "Back", tourDone: "Start",
    tour: [
      ["The play button", "Press the green button and a ready-made darbuka rhythm starts looping. Change the speed with the BPM box next to it."],
      ["Change the rhythm", "Click the cells. Each click cycles normal, strong, soft and off. Right-click silences a cell outright. Click a drum name on the left to mute the whole row."],
      ["Pick an usul", "Maqsum, Çiftetelli, Karşılama and more are built in. Press the question mark beside the list to read what each one is."],
      ["Makam and bağlama", "Choose a makam and play the piano. With smart scale on you cannot hit a wrong note, every key lands on a makam pitch."],
      ["Record notes", "While it plays, press Record and play the piano. Your notes land in the piano roll above, where you can drag them around and right-click to delete."],
      ["Export", "When you are happy, download an MP3, a WAV, or stems with every instrument in its own file. You can also save the project and pick it up later."]
    ]
  }
};

let lang = "tr", theme = "toprak";
try {
  lang = localStorage.getItem("ckm_lang") || "tr";
  theme = localStorage.getItem("ckm_theme") || "toprak";
} catch (e) {}
const t = k => I18N[lang][k];

const THEMES = { toprak: "Toprak", gece: "Gece", orman: "Orman", gul: "Gül", komur: "Kömür" };

/* ---------- state ---------- */

const state = {
  bpm: 100, usul: "Maqsum (4/4)", bars: 2, swing: 0,
  grid: {}, notes: [], muted: new Set(),
  voice: null, voiceOffsetQ: 0, volVoice: 1.0, fileBuf: null,
  fx: { reverb: 0, echo: 0, chorus: 0, drive: 0, bass: 0, treble: 0, comp: false, phone: false },
  playing: false, recording: false,
  makam: "Hicaz", tonic: 220.0, smart: true, strings: "metal", inst: "baglama",
  volDrums: 0.9, volBaglama: 0.9
};

let ctx = null, nodes = null;
const buffers = {};
let keys = [];
let schedTimer = null, stepCursor = 0, nextStepTime = 0, loopStartTime = 0, scheduledLoop = -1, rafId = 0;
const held = new Set();
let midiAccess = null, midiInputId = "all";
let tipTimer = 0, tourStep = 0;

/* ---------- helpers ---------- */

const $ = id => document.getElementById(id);
const usulDef = () => USULS[state.usul];
const totalSteps = () => usulDef().steps * state.bars;
const stepDur = () => usulDef().quarters * 60 / state.bpm / usulDef().steps;
const loopDur = () => stepDur() * totalSteps();
// Notes live in musical time (quarter notes) so changing the tempo moves them with it.
const loopQ = () => usulDef().quarters * state.bars;
const stepQ = () => usulDef().quarters / usulDef().steps;
const qToSec = q => q * 60 / state.bpm;
const secToQ = sec => sec * state.bpm / 60;
const swingShift = i => (i % 2 === 1 ? state.swing * stepDur() * 0.5 : 0);

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const isWhite = m => WHITE_PCS.includes(((m % 12) + 12) % 12);
const midiToName = m => t("noteNames")[((m % 12) + 12) % 12] + Math.floor(m / 12);

function pickSample(freq) {
  if (state.inst !== "baglama") {
    let ref = SYNTH_REFS[0];
    for (const f of SYNTH_REFS)
      if (Math.abs(Math.log2(freq / f)) < Math.abs(Math.log2(freq / ref))) ref = f;
    return { name: state.inst + "_" + ref, rate: freq / ref };
  }
  let best = null, bestDist = 1e9;
  for (const [name, f0] of Object.entries(BAGLAMA_F0)) {
    const d = Math.abs(Math.log2(freq / f0));
    if (d < bestDist) { bestDist = d; best = name; }
  }
  return { name: "bag_" + best, rate: freq / BAGLAMA_F0[best] };
}

/* ---------- keyboard model ---------- */

function buildKeys() {
  const pat = MAKAMS[state.makam].steps;
  const tonicMidi = Math.round(69 + 12 * Math.log2(state.tonic / 440));

  const degrees = [];
  let commas = -53;
  for (let oct = 0; oct < 2; oct++)
    for (let d = 0; d < 7; d++) { degrees.push({ commas, deg: d }); commas += pat[d]; }
  degrees.push({ commas, deg: 0 });

  let lo = tonicMidi - 12, hi = tonicMidi + 12;
  while (!isWhite(lo)) lo--;
  while (!isWhite(hi)) hi++;

  keys = [];
  for (let m = lo; m <= hi; m++) {
    const cents = (m - tonicMidi) * 100;
    const hit = degrees.find(d => Math.abs(d.commas * 1200 / 53 - cents) < 25);
    keys.push({
      midi: m, white: isWhite(m), cents,
      freq: hit ? state.tonic * Math.pow(2, hit.commas / 53)
                : state.tonic * Math.pow(2, (m - tonicMidi) / 12),
      inScale: !!hit,
      isTonic: hit ? hit.deg === 0 : false
    });
  }
  for (const k of keys) {
    if (k.inScale) { k.snapFreq = k.freq; continue; }
    let best = degrees[0], bd = 1e9;
    for (const d of degrees) {
      const dist = Math.abs(d.commas * 1200 / 53 - k.cents);
      if (dist < bd) { bd = dist; best = d; }
    }
    k.snapFreq = state.tonic * Math.pow(2, best.commas / 53);
  }
}

const keyFreq = k => (state.smart ? k.snapFreq : k.freq);
const keyIndexByMidi = m => keys.findIndex(k => k.midi === m);

/* ---------- audio ---------- */

async function initAudio() {
  if (ctx) { if (ctx.state === "suspended") await ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
  nodes = buildGraph(ctx);
  buildSynths(ctx);
  await Promise.all(Object.entries(SOUND_FILES).map(async ([key, url]) => {
    const res = await fetch(url);
    buffers[key] = await ctx.decodeAudioData(await res.arrayBuffer());
  }));
}

function buildGraph(ac) {
  const master = ac.createGain();
  master.connect(ac.destination);

  const drums = ac.createGain();
  drums.gain.value = state.volDrums;
  drums.connect(master);

  const bagIn = ac.createGain();
  const bagOut = ac.createGain();
  bagOut.gain.value = state.volBaglama;
  bagOut.connect(master);

  const metal = ac.createGain();
  bagIn.connect(metal).connect(bagOut);

  // Plastic strings: tame the bright upper harmonics of the metal-string samples.
  const lp1 = ac.createBiquadFilter(); lp1.type = "lowpass"; lp1.frequency.value = 1600; lp1.Q.value = 0.9;
  const lp2 = ac.createBiquadFilter(); lp2.type = "lowpass"; lp2.frequency.value = 2400;
  const dip = ac.createBiquadFilter(); dip.type = "peaking"; dip.frequency.value = 700; dip.Q.value = 1.2; dip.gain.value = -7;
  const low = ac.createBiquadFilter(); low.type = "peaking"; low.frequency.value = 200; low.Q.value = 1.0; low.gain.value = 3;
  const makeup = ac.createGain(); makeup.gain.value = 1.7;
  const plastic = ac.createGain();
  bagIn.connect(lp1).connect(lp2).connect(dip).connect(low).connect(makeup).connect(plastic).connect(bagOut);

  const metalOn = state.strings === "metal";
  metal.gain.value = metalOn ? 1 : 0;
  plastic.gain.value = metalOn ? 0 : 1;

  // voice chain: tone, colour, dynamics, then three parallel sends
  const fx = state.fx;
  const voiceIn = ac.createGain();
  const voiceOut = ac.createGain();
  voiceOut.gain.value = state.volVoice;
  voiceOut.connect(master);

  const bass = ac.createBiquadFilter();
  bass.type = "lowshelf"; bass.frequency.value = 220; bass.gain.value = fx.bass;
  const treble = ac.createBiquadFilter();
  treble.type = "highshelf"; treble.frequency.value = 3200; treble.gain.value = fx.treble;
  voiceIn.connect(bass).connect(treble);

  // drive, mixed in parallel so the clean signal is never lost
  const shaper = ac.createWaveShaper();
  shaper.curve = driveCurve(400);
  shaper.oversample = "2x";
  const driveWet = ac.createGain(); driveWet.gain.value = fx.drive * 0.8;
  const driveDry = ac.createGain(); driveDry.gain.value = 1 - fx.drive * 0.5;
  const afterDrive = ac.createGain();
  treble.connect(driveDry).connect(afterDrive);
  treble.connect(shaper).connect(driveWet).connect(afterDrive);

  // a narrow band gives the old-telephone colour
  const phone = ac.createBiquadFilter();
  phone.type = "bandpass"; phone.frequency.value = 1500; phone.Q.value = 1.1;
  const phoneWet = ac.createGain(); phoneWet.gain.value = fx.phone ? 1.6 : 0;
  const phoneDry = ac.createGain(); phoneDry.gain.value = fx.phone ? 0 : 1;
  const afterPhone = ac.createGain();
  afterDrive.connect(phoneDry).connect(afterPhone);
  afterDrive.connect(phone).connect(phoneWet).connect(afterPhone);

  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -26; comp.ratio.value = 5; comp.attack.value = 0.005; comp.release.value = 0.2;
  const compWet = ac.createGain(); compWet.gain.value = fx.comp ? 1.5 : 0;
  const compDry = ac.createGain(); compDry.gain.value = fx.comp ? 0 : 1;
  const post = ac.createGain();
  afterPhone.connect(compDry).connect(post);
  afterPhone.connect(comp).connect(compWet).connect(post);

  post.connect(voiceOut);

  // chorus: a short delay whose time wobbles, which thickens a single voice
  const chDelay = ac.createDelay(0.1);
  chDelay.delayTime.value = 0.022;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.6;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 0.004;
  lfo.connect(lfoGain).connect(chDelay.delayTime);
  lfo.start(0);
  const chorusWet = ac.createGain(); chorusWet.gain.value = fx.chorus;
  post.connect(chDelay).connect(chorusWet).connect(voiceOut);

  const delay = ac.createDelay(2);
  delay.delayTime.value = Math.min(1.2, stepDur() * 2);
  const feedback = ac.createGain();
  feedback.gain.value = 0.34;
  const echoWet = ac.createGain();
  echoWet.gain.value = fx.echo;
  post.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(echoWet).connect(voiceOut);

  const conv = ac.createConvolver();
  conv.buffer = makeImpulse(ac, 2.4, 2.6);
  const revWet = ac.createGain();
  revWet.gain.value = fx.reverb;
  post.connect(conv).connect(revWet).connect(voiceOut);

  return { master, drums, bagIn, bagOut, metal, plastic, voiceIn, voiceOut,
           echoWet, revWet, chorusWet, delay, bass, treble,
           driveWet, driveDry, phoneWet, phoneDry, compWet, compDry };
}

// Soft saturation curve: gentle at low settings, grittier as it is pushed.
function driveCurve(amount) {
  const n = 1024, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * Math.PI / 180) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

// A short burst of filtered noise decaying away makes a serviceable room.
function makeImpulse(ac, seconds, decay) {
  const n = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(2, n, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) {
      const t2 = i / n;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t2, decay) * (i < ac.sampleRate * 0.01 ? 0 : 1);
    }
  }
  return buf;
}

let voiceSources = [];

function stopVoiceSources() {
  for (const s of voiceSources) { try { s.stop(); } catch (e) {} }
  voiceSources = [];
}

function playVoice(ac, g, time) {
  if (!state.voice) return;
  if (ac === ctx) stopVoiceSources();          // one take at a time, never stacked
  const src = ac.createBufferSource();
  src.buffer = state.voice;
  src.connect(g.voiceIn);
  src.start(Math.max(time + qToSec(state.voiceOffsetQ), ac.currentTime), 0);
  if (ac === ctx) {
    voiceSources.push(src);
    src.onended = () => { voiceSources = voiceSources.filter(s => s !== src); };
  }
}

let liveSources = [];

function track(ac, src) {
  if (ac !== ctx) return;
  liveSources.push(src);
  src.onended = () => { liveSources = liveSources.filter(s => s !== src); };
}

function stopAllSources() {
  for (const s of liveSources) { try { s.stop(); } catch (e) {} }
  liveSources = [];
  voiceSources = [];
}

function playDrum(ac, g, rowId, time, vel) {
  const buf = buffers[rowId];
  if (!buf) return;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const gain = ac.createGain();
  gain.gain.value = vel;
  src.connect(gain).connect(g.drums);
  src.start(Math.max(time, ac.currentTime));
  track(ac, src);
}

function playNote(ac, g, freq, time, vel = 0.9) {
  const pick = pickSample(freq);
  const buf = buffers[pick.name];
  if (!buf) return;
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = pick.rate;
  const gain = ac.createGain();
  gain.gain.value = vel;
  src.connect(gain).connect(g.bagIn);
  src.start(Math.max(time, ac.currentTime));
  track(ac, src);
}

/* Kanun and ney have no CC0 single-note recordings worth using, so they are
   synthesised here: the kanun as detuned plucked strings, the ney as a breathy
   pipe. Rendered once at load into buffers, then pitch-shifted like a sample. */
const SYNTH_REFS = [110, 220, 440];

function synthKanun(ac, f0) {
  const sr = ac.sampleRate, len = Math.floor(sr * 1.8);
  const buf = ac.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  for (const det of [-4, 0, 5]) {                       // three courses, lightly detuned
    const f = f0 * Math.pow(2, det / 1200);
    const n = Math.max(2, Math.round(sr / f));
    const ring = new Float32Array(n);
    for (let i = 0; i < n; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0, prev = 0;
    for (let i = 0; i < len; i++) {
      const cur = ring[idx];
      const v = (cur + prev) * 0.5 * 0.9985;            // bright, slow decay
      ring[idx] = v;
      prev = cur;
      idx = (idx + 1) % n;
      out[i] += cur * Math.exp(-i / sr * 1.1) / 3;
    }
  }
  const atk = Math.floor(sr * 0.002);
  for (let i = 0; i < atk; i++) out[i] *= i / atk;
  return buf;
}

function synthNey(ac, f0) {
  const sr = ac.sampleRate, len = Math.floor(sr * 2.2);
  const buf = ac.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const t2 = i / sr;
    const env = Math.min(1, t2 / 0.09) * Math.exp(-t2 * 0.55);
    const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.2 * t2) * Math.min(1, t2 / 0.4);
    const ph = 2 * Math.PI * f0 * vib * t2;
    let v = Math.sin(ph) + 0.34 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph) + 0.05 * Math.sin(4 * ph);
    lp = lp * 0.72 + (Math.random() * 2 - 1) * 0.28;    // breath
    out[i] = (v * 0.42 + lp * 0.3 * Math.min(1, t2 / 0.05)) * env;
  }
  return buf;
}

function buildSynths(ac) {
  for (const f of SYNTH_REFS) {
    buffers["kanun_" + f] = synthKanun(ac, f);
    buffers["ney_" + f] = synthNey(ac, f);
  }
}

const VELS = [0, 0.8, 1.0, 0.5];
const humanVel = v => Math.max(0.1, v + (Math.random() - 0.5) * 0.08);

/* ---------- transport ---------- */

function setPlayIcon() {
  $("play").innerHTML = state.playing
    ? '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="6" y="5" width="4.5" height="14" rx="1" fill="currentColor"/><rect x="13.5" y="5" width="4.5" height="14" rx="1" fill="currentColor"/></svg>'
    : '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
  $("play").title = state.playing ? t("stop") : t("play");
  $("play").setAttribute("aria-label", state.playing ? t("stop") : t("play"));
}

function startPlayback() {
  stepCursor = 0; scheduledLoop = -1;
  nextStepTime = loopStartTime = ctx.currentTime + 0.1;
  schedTimer = setInterval(schedule, 25);
  state.playing = true;
  $("play").classList.add("playing");
  setPlayIcon();
  rafId = requestAnimationFrame(movePlayhead);
}

function movePlayhead() {
  const ph = $("playhead");
  if (ph && ctx) {
    let p = (ctx.currentTime - loopStartTime) % loopDur();
    if (p < 0) p += loopDur();
    ph.style.left = (p / loopDur()) * timeW() + "px";
  }
  if (state.playing) rafId = requestAnimationFrame(movePlayhead);
}

// Re-anchor the running loop after a change that moves every later event.
function resyncTransport() {
  if (!state.playing) return;
  stopAllSources();
  stepCursor = 0;
  scheduledLoop = -1;
  nextStepTime = loopStartTime = ctx.currentTime + 0.06;
}

function stopPlayback() {
  clearInterval(schedTimer); schedTimer = null;
  cancelAnimationFrame(rafId);
  stopAllSources();
  state.playing = false;
  if (state.recording) toggleRec(false);
  $("play").classList.remove("playing");
  setPlayIcon();
  document.querySelectorAll(".cell.now").forEach(c => c.classList.remove("now"));
}

function schedule() {
  const ahead = ctx.currentTime + 0.12;
  while (nextStepTime < ahead) {
    const steps = totalSteps();
    const local = stepCursor % steps;
    const loopIdx = Math.floor(stepCursor / steps);
    if (local === 0) {
      loopStartTime = nextStepTime;
      if (scheduledLoop < loopIdx) {
        scheduledLoop = loopIdx;
        playVoice(ctx, nodes, nextStepTime);
      }
    }
    // notes land in the step they belong to, so a tempo change takes effect at once
    const fromQ = local * stepQ(), toQ = fromQ + stepQ();
    for (const n of state.notes)
      if (n.q >= fromQ - 1e-9 && n.q < toQ - 1e-9)
        playNote(ctx, nodes, n.f, nextStepTime + qToSec(n.q - fromQ), n.vel);

    const at = nextStepTime + swingShift(local);
    for (const row of DRUM_ROWS) {
      if (state.muted.has(row)) continue;
      const v = state.grid[row][local];
      if (v) playDrum(ctx, nodes, row, at + (Math.random() - 0.5) * 0.004, humanVel(VELS[v]));
    }
    markPlayhead(local, nextStepTime);
    stepCursor++;
    nextStepTime += stepDur();
  }
}

function markPlayhead(local, when) {
  setTimeout(() => {
    if (!state.playing) return;
    document.querySelectorAll(".cell.now").forEach(c => c.classList.remove("now"));
    document.querySelectorAll('.cell[data-step="' + local + '"]').forEach(c => c.classList.add("now"));
  }, Math.max(0, (when - ctx.currentTime) * 1000));
}

/* ---------- drum grid ---------- */

function initGrid(applyPreset) {
  const steps = totalSteps();
  for (const row of DRUM_ROWS) {
    const old = state.grid[row];
    const arr = new Uint8Array(steps);
    if (!applyPreset && old) arr.set(old.subarray(0, Math.min(old.length, steps)));
    state.grid[row] = arr;
  }
  if (applyPreset) {
    const u = usulDef();
    for (const [rowId, pat] of Object.entries(u.rows))
      for (let b = 0; b < state.bars; b++)
        for (let i = 0; i < u.steps; i++) {
          const ch = pat[i];
          state.grid[rowId][b * u.steps + i] = ch === "X" ? 2 : ch === "x" ? 1 : ch === "o" ? 3 : 0;
        }
  }
  renderGrid();
}

function renderGrid() {
  const u = usulDef();
  const beatStarts = new Set();
  let acc = 0;
  for (const g of u.groups) { beatStarts.add(acc); acc += g; }
  // which beat each cell belongs to, so the bar can be read at a glance
  const groupOf = [];
  u.groups.forEach((g, gi) => { for (let k = 0; k < g; k++) groupOf.push(gi); });

  const grid = $("grid");
  grid.innerHTML = "";

  const ruler = document.createElement("div");
  ruler.className = "ruler";
  const pad = document.createElement("div");
  pad.className = "pad";
  ruler.appendChild(pad);
  for (let i = 0; i < totalSteps(); i++) {
    const tick = document.createElement("div");
    const local = i % u.steps;
    tick.className = "tick" + (local === 0 ? " beat" : "");
    tick.textContent = local === 0 ? String(Math.floor(i / u.steps) + 1)
                     : beatStarts.has(local) ? String(groupOf[local] + 1) : "";
    ruler.appendChild(tick);
  }
  grid.appendChild(ruler);

  for (const row of DRUM_ROWS) {
    const div = document.createElement("div");
    div.className = "row";
    const lab = document.createElement("button");
    lab.className = "rowlabel" + (state.muted.has(row) ? " muted" : "");
    lab.textContent = t("drums")[row];
    lab.title = t("muteTip");
    const toggleMute = e => {
      e.preventDefault();
      state.muted.has(row) ? state.muted.delete(row) : state.muted.add(row);
      lab.classList.toggle("muted", state.muted.has(row));
      lab.blur();
    };
    lab.addEventListener("click", toggleMute);
    lab.addEventListener("contextmenu", toggleMute);
    div.appendChild(lab);
    for (let i = 0; i < totalSteps(); i++) {
      const cell = document.createElement("button");
      cell.className = "cell g" + (groupOf[i % u.steps] % 2);
      cell.dataset.step = i;
      if (beatStarts.has(i % u.steps)) cell.classList.add("beat");
      paintCell(cell, state.grid[row][i]);
      cell.addEventListener("click", async () => {
        const cur = state.grid[row][i];
        const next = cur === 0 ? 1 : cur === 1 ? 2 : cur === 2 ? 3 : 0;
        state.grid[row][i] = next;
        paintCell(cell, next);
        cell.blur();
        if (next) { await initAudio(); playDrum(ctx, nodes, row, ctx.currentTime, VELS[next]); }
      });
      cell.addEventListener("contextmenu", e => {
        e.preventDefault();
        state.grid[row][i] = 0;
        paintCell(cell, 0);
      });
      div.appendChild(cell);
    }
    grid.appendChild(div);
  }
}

function paintCell(cell, v) {
  cell.classList.toggle("on", v === 1);
  cell.classList.toggle("strong", v === 2);
  cell.classList.toggle("soft", v === 3);
}

/* ---------- piano roll: time runs left to right, pitch stacked top to bottom ---------- */

const wideScreen = () => window.innerWidth > 760;
const LANE_H = () => (wideScreen() ? 17 : 15);
let cellW = 30;
const CELL_W = () => cellW;
const timeW = () => cellW * totalSteps();

// With smart scale on, only the makam's own pitches get a lane, so the roll fits
// on screen and reads cleanly. Off, every semitone gets one.
let rollKeys = [];
function buildRollKeys() {
  rollKeys = state.smart ? keys.filter(k => k.inScale) : keys.slice();
  if (!rollKeys.length) rollKeys = keys.slice();
}
const laneOf = i => rollKeys.length - 1 - i;          // highest pitch on top

function rollIndexForMidi(m) {
  const exact = rollKeys.findIndex(k => k.midi === m);
  if (exact >= 0) return exact;
  let best = 0, bd = 1e9;
  rollKeys.forEach((k, i) => { const d = Math.abs(k.midi - m); if (d < bd) { bd = d; best = i; } });
  return best;
}

function laneAtY(y) {
  const li = Math.floor(y / LANE_H());
  const i = rollKeys.length - 1 - li;
  return rollKeys[i] ? i : null;
}

function placeNote(el, n) {
  const i = rollIndexForMidi(n.midi);
  el.style.left = (n.q / loopQ()) * timeW() + "px";
  el.style.width = Math.max(7, (n.lenQ / loopQ()) * timeW() - 1) + "px";
  el.style.top = laneOf(i) * LANE_H() + 1 + "px";
  el.style.height = LANE_H() - 2 + "px";
}

function renderRoll() {
  const strip = $("keystrip"), area = $("rollarea"), wrap = $("rollwrap");
  if (!strip || !area) return;
  buildRollKeys();

  // Spread the steps across the panel instead of leaving empty space on the right.
  const stripW = wideScreen() ? 62 : 52;
  const avail = (wrap.clientWidth || 900) - stripW - 4;
  cellW = Math.max(wideScreen() ? 26 : 22, Math.floor(avail / totalSteps()));

  const lh = LANE_H(), u = usulDef(), h = rollKeys.length * lh;
  wrap.style.maxHeight = Math.min(h + 2, wideScreen() ? 360 : 230) + "px";
  strip.style.height = h + "px";
  area.style.height = h + "px";
  area.style.width = timeW() + "px";
  strip.innerHTML = "";
  area.innerHTML = "";

  for (let li = 0; li < rollKeys.length; li++) {
    const idx = rollKeys.length - 1 - li;
    const k = rollKeys[idx];
    const kb = document.createElement("button");
    kb.className = "kstrip " + (k.white ? "w" : "b") +
      (k.isTonic ? " tonic" : "") + (k.inScale ? "" : " outscale");
    kb.style.height = lh + "px";
    kb.textContent = midiToName(k.midi);
    kb.addEventListener("pointerdown", e => {
      e.preventDefault();
      hitKey(keyIndexByMidi(k.midi));
    });
    strip.appendChild(kb);

    const lane = document.createElement("div");
    lane.className = "lane " + (k.white ? "w" : "b") + (k.inScale ? "" : " outscale");
    lane.style.top = li * lh + "px";
    lane.style.height = lh + "px";
    area.appendChild(lane);
  }

  const beatStarts = new Set();
  let acc = 0;
  for (const g of u.groups) { beatStarts.add(acc); acc += g; }
  for (let i = 0; i < totalSteps(); i++) {
    const line = document.createElement("div");
    line.className = "vline" + (beatStarts.has(i % u.steps) ? " beat" : "");
    line.style.left = i * CELL_W() + "px";
    area.appendChild(line);
  }

  for (const n of state.notes) {
    if (n.midi === undefined) {
      let best = keys[0], bd = 1e9;
      for (const k of keys) { const d = Math.abs(Math.log2(n.f / keyFreq(k))); if (d < bd) { bd = d; best = k; } }
      n.midi = best.midi;
    }
    if (n.q === undefined) n.q = secToQ(n.t || 0);
    if (n.lenQ === undefined) n.lenQ = n.len !== undefined ? secToQ(n.len) : stepQ();
    const el = document.createElement("div");
    el.className = "note";
    placeNote(el, n);
    el.addEventListener("pointerdown", e => startDrag(e, n, el));
    el.addEventListener("contextmenu", e => {
      e.preventDefault();
      state.notes.splice(state.notes.indexOf(n), 1);
      updateNoteCount();
      renderRoll();
    });
    area.appendChild(el);
  }

  const ph = document.createElement("div");
  ph.className = "playhead";
  ph.id = "playhead";
  area.appendChild(ph);

  area.onpointerdown = async e => {
    if (e.target !== area) return;
    const r = area.getBoundingClientRect();
    const i = laneAtY(e.clientY - r.top);
    if (i === null) return;
    const k = rollKeys[i];
    let q = (e.clientX - r.left) / timeW() * loopQ();
    if ($("quantize").checked) q = Math.round(q / stepQ()) * stepQ();
    q = Math.max(0, Math.min(q, loopQ() - stepQ() / 2));
    state.notes.push({ q, f: keyFreq(k), midi: k.midi, vel: 0.9, lenQ: stepQ() });
    updateNoteCount();
    renderRoll();
    await initAudio();
    playNote(ctx, nodes, keyFreq(k), ctx.currentTime);
  };
}

function startDrag(e, n, el) {
  e.preventDefault();
  e.stopPropagation();
  const area = $("rollarea"), r = area.getBoundingClientRect();
  const grabX = e.clientX - r.left - (n.q / loopQ()) * timeW();
  el.setPointerCapture(e.pointerId);
  el.classList.add("dragging");

  const move = ev => {
    let q = (ev.clientX - r.left - grabX) / timeW() * loopQ();
    if ($("quantize").checked) q = Math.round(q / stepQ()) * stepQ();
    n.q = Math.max(0, Math.min(q, loopQ() - stepQ() / 2));
    const i = laneAtY(ev.clientY - r.top);
    if (i !== null) { n.midi = rollKeys[i].midi; n.f = keyFreq(rollKeys[i]); }
    placeNote(el, n);
  };
  const up = () => {
    el.classList.remove("dragging");
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
}

/* ---------- playable keyboard ---------- */

function renderKeys() {
  buildKeys();
  const WW = wideScreen() ? 46 : 38, BW = wideScreen() ? 28 : 23;
  const piano = $("piano");
  piano.innerHTML = "";

  const whites = document.createElement("div");
  whites.className = "whites";
  const blacks = document.createElement("div");
  blacks.className = "blacks";

  let whiteCount = 0;
  keys.forEach((k, i) => {
    const btn = document.createElement("button");
    btn.className = (k.white ? "wkey" : "bkey") +
      (k.isTonic ? " tonic" : "") + (k.inScale ? " inscale" : " outscale");
    btn.dataset.i = i;
    btn.innerHTML = '<span class="lbl">' + midiToName(k.midi) + "</span>";
    btn.title = Math.round(keyFreq(k)) + " Hz";
    btn.addEventListener("pointerdown", e => { e.preventDefault(); hitKey(i); });
    if (k.white) {
      btn.style.width = WW + "px";
      whites.appendChild(btn);
      whiteCount++;
    } else {
      btn.style.width = BW + "px";
      btn.style.left = (whiteCount * WW - BW / 2) + "px";
      blacks.appendChild(btn);
    }
  });
  whites.style.width = whiteCount * WW + "px";
  piano.appendChild(whites);
  piano.appendChild(blacks);
  $("kbHint").textContent = t("kbHint");
  renderRoll();
}

// With smart scale on, an out-of-scale key sounds a makam pitch, so the note is
// filed under the key that actually sounds rather than the one pressed.
function soundingKey(k) {
  if (!state.smart || k.inScale) return k;
  let best = k, bd = 1e9;
  for (const x of keys) {
    if (!x.inScale) continue;
    const d = Math.abs(x.freq - k.snapFreq);
    if (d < bd) { bd = d; best = x; }
  }
  return best;
}

async function hitKey(i, vel = 0.9) {
  const k = keys[i];
  if (!k) return;
  await initAudio();
  playNote(ctx, nodes, keyFreq(k), ctx.currentTime, vel);
  const btn = document.querySelector('[data-i="' + i + '"]');
  if (btn) { btn.classList.add("active"); setTimeout(() => btn.classList.remove("active"), 140); }
  if (state.recording && state.playing) recordNote(soundingKey(k), vel);
}

function recordNote(k, vel) {
  let q = secToQ(((ctx.currentTime - loopStartTime) % loopDur() + loopDur()) % loopDur());
  if ($("quantize").checked) {
    q = Math.round(q / stepQ()) * stepQ();
    if (q >= loopQ()) q = 0;
  }
  state.notes.push({ q, f: keyFreq(k), midi: k.midi, vel, lenQ: stepQ() });
  updateNoteCount();
  renderRoll();
}

function updateNoteCount() {
  $("noteCount").textContent = state.notes.length ? state.notes.length + " " + t("notes") : "";
}

function toggleRec(force) {
  state.recording = force !== undefined ? force : !state.recording;
  $("rec").classList.toggle("armed", state.recording);
  const inst = $("instSel");
  inst.innerHTML = "";
  for (const v of ["baglama", "kanun", "ney"]) {
    const o = document.createElement("option");
    o.value = v; o.textContent = t(v);
    if (v === state.inst) o.selected = true;
    inst.appendChild(o);
  }
  $("instTitle").textContent = t(state.inst);
  $("rec").textContent = state.recording ? t("recording") : t("record");
}

/* ---------- computer keyboard and MIDI ---------- */

const KEY_MAP = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7,
  KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14,
  KeyP: 15, Semicolon: 16, Quote: 17
};
const DRUM_KEYS = ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM"];

function onKeyDown(e) {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "Escape") { hideTip(); if (!$("tour").hidden) closeTour(); return; }
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea") return;
  if (!$("tour").hidden) return;

  if (e.code === "Space") {
    e.preventDefault();
    initAudio().then(() => state.playing ? stopPlayback() : startPlayback());
    return;
  }
  const di = DRUM_KEYS.indexOf(e.code);
  if (di >= 0) {
    e.preventDefault();
    initAudio().then(() => playDrum(ctx, nodes, DRUM_ROWS[di], ctx.currentTime, 1.0));
    return;
  }
  const off = KEY_MAP[e.code];
  if (off === undefined) return;
  e.preventDefault();
  const base = keys.findIndex(k => k.midi >= keys[0].midi + 12);
  const i = (base < 0 ? 0 : base) + off;
  if (!held.has(e.code)) { held.add(e.code); hitKey(i); }
}

function onKeyUp(e) { held.delete(e.code); }

async function connectMidi() {
  const st = $("midiStatus");
  if (!navigator.requestMIDIAccess) { st.textContent = t("midiNo"); return; }
  try {
    midiAccess = await navigator.requestMIDIAccess();
    midiAccess.onstatechange = bindMidi;
    bindMidi();
  } catch (err) {
    st.textContent = t("midiDenied");
  }
}

function bindMidi() {
  if (!midiAccess) return;
  const sel = $("midiSel"), st = $("midiStatus");
  const inputs = [...midiAccess.inputs.values()];
  sel.innerHTML = "";
  if (!inputs.length) {
    sel.hidden = true;
    st.textContent = t("midiNone");
    return;
  }
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = lang === "tr" ? "Tüm cihazlar" : "All devices";
  sel.appendChild(all);
  for (const inp of inputs) {
    const o = document.createElement("option");
    o.value = inp.id;
    o.textContent = inp.name;
    sel.appendChild(o);
  }
  if (![...sel.options].some(o => o.value === midiInputId)) midiInputId = "all";
  sel.value = midiInputId;
  sel.hidden = false;
  for (const inp of inputs)
    inp.onmidimessage = (midiInputId === "all" || inp.id === midiInputId) ? onMidi : null;
  st.textContent = inputs.length + (lang === "tr" ? " cihaz bağlı" : " device(s) connected");
}

function onMidi(msg) {
  const [status, note, vel] = msg.data;
  if ((status & 0xf0) !== 0x90 || !vel) return;
  let i = keyIndexByMidi(note);
  if (i < 0) {
    const lo = keys[0].midi, hi = keys[keys.length - 1].midi;
    let n = note;
    while (n < lo) n += 12;
    while (n > hi) n -= 12;
    i = keyIndexByMidi(n);
  }
  if (i >= 0) hitKey(i, Math.max(0.15, vel / 127));      // velocity from the controller
}

/* ---------- export ---------- */

async function renderOffline(repeats, parts) {
  const dur = loopDur() * repeats + 1.8;
  const oc = new OfflineAudioContext(2, Math.ceil(dur * 48000), 48000);
  const g = buildGraph(oc);
  const sd = stepDur(), steps = totalSteps();
  for (let r = 0; r < repeats; r++) {
    const base = 0.05 + r * loopDur();
    if (parts.drums)
      for (let i = 0; i < steps; i++)
        for (const row of DRUM_ROWS) {
          if (state.muted.has(row)) continue;
          const v = state.grid[row][i];
          if (v) playDrum(oc, g, row, base + i * sd + swingShift(i), humanVel(VELS[v]));
        }
    if (parts.baglama)
      for (const n of state.notes) playNote(oc, g, n.f, base + qToSec(n.q), n.vel);
    if (parts.voice && state.voice) {
      const src = oc.createBufferSource();
      src.buffer = state.voice;
      src.connect(g.voiceIn);
      src.start(Math.max(0, base + qToSec(state.voiceOffsetQ)));
    }
  }
  return oc.startRendering();
}

function bufferToWav(buf) {
  const len = buf.length, ch = 2, bytes = 44 + len * ch * 2;
  const ab = new ArrayBuffer(bytes), v = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, bytes - 8, true); ws(8, "WAVE");
  ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
  v.setUint32(24, 48000, true); v.setUint32(28, 48000 * ch * 2, true);
  v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  ws(36, "data"); v.setUint32(40, len * ch * 2, true);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let o = 44;
  for (let i = 0; i < len; i++) {
    v.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767, true); o += 2;
    v.setInt16(o, Math.max(-1, Math.min(1, R[i])) * 32767, true); o += 2;
  }
  return new Uint8Array(ab);
}

function encodeMp3(buf) {
  return new Promise((resolve, reject) => {
    const w = new Worker("export-worker.js");
    const l = new Float32Array(buf.getChannelData(0));
    const r = new Float32Array(buf.getChannelData(1));
    w.onmessage = e => {
      e.data.error ? reject(new Error(e.data.error))
                   : resolve(new Blob(e.data.chunks, { type: "audio/mpeg" }));
      w.terminate();
    };
    w.onerror = e => { reject(new Error(e.message || "Worker error")); w.terminate(); };
    w.postMessage({ l, r }, [l.buffer, r.buffer]);
  });
}

const CRC_TABLE = (() => {
  const tb = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    tb[n] = c >>> 0;
  }
  return tb;
})();
function crc32(d) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < d.length; i++) c = CRC_TABLE[(c ^ d[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function makeZip(files) {
  const chunks = [], central = [];
  let offset = 0;
  const le16 = n => [n & 255, (n >> 8) & 255];
  const le32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  for (const [name, data] of files) {
    const nameB = new TextEncoder().encode(name);
    const crc = crc32(data);
    const local = new Uint8Array([0x50, 0x4B, 0x03, 0x04, ...le16(20), ...le16(0), ...le16(0),
      ...le16(0), ...le16(0), ...le32(crc), ...le32(data.length), ...le32(data.length),
      ...le16(nameB.length), ...le16(0)]);
    chunks.push(local, nameB, data);
    central.push({ nameB, crc, size: data.length, offset });
    offset += local.length + nameB.length + data.length;
  }
  const cdStart = offset;
  for (const e of central) {
    const rec = new Uint8Array([0x50, 0x4B, 0x01, 0x02, ...le16(20), ...le16(20), ...le16(0),
      ...le16(0), ...le16(0), ...le16(0), ...le32(e.crc), ...le32(e.size), ...le32(e.size),
      ...le16(e.nameB.length), ...le16(0), ...le16(0), ...le16(0), ...le16(0), ...le32(0),
      ...le32(e.offset)]);
    chunks.push(rec, e.nameB);
    offset += rec.length + e.nameB.length;
  }
  chunks.push(new Uint8Array([0x50, 0x4B, 0x05, 0x06, ...le16(0), ...le16(0),
    ...le16(central.length), ...le16(central.length), ...le32(offset - cdStart), ...le32(cdStart), ...le16(0)]));
  return new Blob(chunks, { type: "application/zip" });
}

function stamp() {
  const d = new Date(), p = n => String(n).padStart(2, "0");
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

async function doExport(kind) {
  await initAudio();
  if (state.playing) stopPlayback();
  const status = $("exportStatus");
  status.textContent = t("rendering");
  const repeats = parseInt($("repeats").value, 10);
  try {
    if (kind === "stems") {
      const files = [["darbuka.wav", bufferToWav(await renderOffline(repeats, { drums: true }))],
                     ["baglama.wav", bufferToWav(await renderOffline(repeats, { baglama: true }))]];
      if (state.voice)
        files.push(["ses.wav", bufferToWav(await renderOffline(repeats, { voice: true }))]);
      status.textContent = t("packing");
      download(makeZip(files), "ck-makam-stems-" + stamp() + ".zip");
    } else {
      const mix = await renderOffline(repeats, { drums: true, baglama: true, voice: true });
      if (kind === "wav")
        download(new Blob([bufferToWav(mix)], { type: "audio/wav" }), "ck-makam-" + stamp() + ".wav");
      else {
        status.textContent = t("encoding");
        download(await encodeMp3(mix), "ck-makam-" + stamp() + ".mp3");
      }
    }
    status.textContent = t("done");
  } catch (err) {
    status.textContent = t("failed") + err.message;
  }
  setTimeout(() => { if (status.textContent === t("done")) status.textContent = ""; }, 4000);
}

/* ---------- microphone layer ---------- */

let micRecorder = null, micStream = null, voiceBaseQ = 0;

async function toggleMic() {
  const btn = $("micBtn"), st = $("micStatus");
  if (micRecorder && micRecorder.state === "recording") { micRecorder.stop(); return; }
  if (!navigator.mediaDevices || !window.MediaRecorder) { st.textContent = t("micNo"); return; }

  let stream;
  try {
    // echo cancellation on, otherwise the mic records the loop coming out of the speakers
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
  } catch (e) {
    st.textContent = t("micDenied");
    return;
  }
  await initAudio();

  const startAtQ = state.playing
    ? secToQ(((ctx.currentTime - loopStartTime) % loopDur() + loopDur()) % loopDur()) : 0;
  const chunks = [];
  const rec = new MediaRecorder(stream);
  micRecorder = rec;
  micStream = stream;

  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onerror = () => { st.textContent = t("failed") + "recorder"; };
  rec.onstop = async () => {
    stream.getTracks().forEach(tr => tr.stop());
    if (micRecorder === rec) micRecorder = null;
    btn.textContent = t("mic");
    btn.classList.remove("armed");
    if (!chunks.length) { st.textContent = t("micEmpty"); return; }
    try {
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
      if (!buf || !buf.duration) { st.textContent = t("micEmpty"); return; }
      state.voice = buf;
      voiceBaseQ = startAtQ;                     // line the take up with where it began
      state.voiceOffsetQ = startAtQ;
      $("micOffset").value = 0;
      $("micClear").hidden = false;
      $("micOffset").parentElement.hidden = false;
      $("fxRow").hidden = false;
      $("toNotes").hidden = false;
      drawWave();
      st.textContent = t("micSaved") + " " + buf.duration.toFixed(1) + "s";
    } catch (err) {
      st.textContent = t("failed") + err.message;
    }
  };

  try {
    rec.start();
  } catch (err) {
    st.textContent = t("failed") + err.message;
    stream.getTracks().forEach(tr => tr.stop());
    micRecorder = null;
    return;
  }
  btn.textContent = t("micRec");
  btn.classList.add("armed");
  st.textContent = t("micOn");
}

function clearVoice() {
  stopVoiceSources();
  state.voice = null;
  state.voiceOffsetQ = 0;
  voiceBaseQ = 0;
  $("micOffset").value = 0;
  $("micClear").hidden = true;
  $("micOffset").parentElement.hidden = true;
  $("fxRow").hidden = true;
  $("toNotes").hidden = true;
  $("micStatus").textContent = "";
  drawWave();
}

// waveform of the take, so you can see where your voice sits
function drawWave() {
  const c = $("wave");
  if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(200, c.clientWidth), h = 72;
  c.width = w * dpr; c.height = h * dpr;
  const cx = c.getContext("2d");
  cx.scale(dpr, dpr);
  cx.clearRect(0, 0, w, h);
  if (!state.voice) { c.hidden = true; return; }
  c.hidden = false;
  const d = state.voice.getChannelData(0);
  const step = Math.max(1, Math.floor(d.length / w));
  cx.fillStyle = cssVar("--accent");
  for (let x = 0; x < w; x++) {
    let lo = 1, hi = -1;
    for (let i = 0; i < step; i++) {
      const v = d[x * step + i] || 0;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const y1 = (1 - hi) * h / 2, y2 = (1 - lo) * h / 2;
    cx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
  }
  cx.strokeStyle = cssVar("--muted");
  cx.globalAlpha = 0.4;
  cx.beginPath(); cx.moveTo(0, h / 2); cx.lineTo(w, h / 2); cx.stroke();
}

/* ---------- audio upload and melody detection ---------- */

async function loadAudioFile(file) {
  const st = $("fileStatus");
  st.textContent = t("reading");
  await initAudio();
  try {
    state.fileBuf = await ctx.decodeAudioData(await file.arrayBuffer());
    $("fileTools").hidden = false;
    drawFileWave();
    st.textContent = file.name + " - " + state.fileBuf.duration.toFixed(1) + "s";
  } catch (e) {
    state.fileBuf = null;
    $("fileTools").hidden = true;
    st.textContent = t("fileBad");
  }
}

function drawFileWave() {
  const c = $("fileWave");
  if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(200, c.clientWidth), h = 72;
  c.width = w * dpr; c.height = h * dpr;
  const cx = c.getContext("2d");
  cx.scale(dpr, dpr);
  cx.clearRect(0, 0, w, h);
  if (!state.fileBuf) { c.hidden = true; return; }
  c.hidden = false;
  const d = state.fileBuf.getChannelData(0);
  const step = Math.max(1, Math.floor(d.length / w));
  cx.fillStyle = cssVar("--accent2");
  for (let x = 0; x < w; x++) {
    let lo = 1, hi = -1;
    for (let i = 0; i < step; i += 3) {
      const v = d[x * step + i] || 0;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const y1 = (1 - hi) * h / 2, y2 = (1 - lo) * h / 2;
    cx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
  }
}

// use the file as a layer, the same way a mic take is used
function fileAsLayer() {
  if (!state.fileBuf) return;
  state.voice = state.fileBuf;
  voiceBaseQ = 0;
  state.voiceOffsetQ = 0;
  $("micOffset").value = 0;
  $("micClear").hidden = false;
  $("micOffset").parentElement.hidden = false;
  $("fxRow").hidden = false;
  $("toNotes").hidden = false;
  drawWave();
  $("micStatus").textContent = t("micSaved") + " " + state.voice.duration.toFixed(1) + "s";
}

// YIN pitch estimate for one window. Monophonic material only.
function yinPitch(d, start, win, sr) {
  const maxLag = Math.min(Math.floor(sr / 65), Math.floor(win / 2));
  const minLag = Math.floor(sr / 1100);
  const diff = new Float32Array(maxLag);
  for (let lag = minLag; lag < maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < win - maxLag; i++) {
      const x = d[start + i] - d[start + i + lag];
      sum += x * x;
    }
    diff[lag] = sum;
  }
  let run = 0;
  const cm = new Float32Array(maxLag);
  for (let lag = minLag; lag < maxLag; lag++) {
    run += diff[lag];
    cm[lag] = diff[lag] * (lag - minLag + 1) / (run || 1e-9);
  }
  let tau = -1;
  for (let lag = minLag + 1; lag < maxLag - 1; lag++)
    if (cm[lag] < 0.16 && cm[lag] <= cm[lag + 1]) { tau = lag; break; }
  if (tau < 0) return 0;
  const a = cm[tau - 1], b = cm[tau], c = cm[tau + 1];
  const shift = (a - 2 * b + c) !== 0 ? 0.5 * (a - c) / (a - 2 * b + c) : 0;
  return sr / (tau + shift);
}

function melodyToNotes(fromFile) {
  const buf = fromFile ? state.fileBuf : state.voice;
  if (!buf) return;
  const st = $(fromFile ? "fileStatus" : "micStatus");
  st.textContent = t("analysing");
  setTimeout(() => {
    const sr = buf.sampleRate, d = buf.getChannelData(0);
    const win = 2048, hop = Math.floor(sr * 0.021);
    const frames = [];
    for (let i = 0; i + win < d.length; i += hop) {
      let rms = 0;
      for (let j = 0; j < win; j += 4) rms += d[i + j] * d[i + j];
      rms = Math.sqrt(rms / (win / 4));
      frames.push(rms < 0.012 ? 0 : yinPitch(d, i, win, sr));
    }
    // group neighbouring frames that hold the same pitch into notes
    const segs = [];
    let cur = null;
    frames.forEach((f, i) => {
      if (!f) { if (cur) { segs.push(cur); cur = null; } return; }
      if (cur && Math.abs(1200 * Math.log2(f / cur.f)) < 70) {
        cur.n++; cur.f = (cur.f * (cur.n - 1) + f) / cur.n;
      } else {
        if (cur) segs.push(cur);
        cur = { start: i, n: 1, f };
      }
    });
    if (cur) segs.push(cur);

    const minFrames = Math.max(3, Math.round(0.07 / (hop / sr)));
    const added = [];
    for (const sg of segs) {
      if (sg.n < minFrames) continue;
      const tSec = sg.start * hop / sr + (fromFile ? 0 : qToSec(state.voiceOffsetQ));
      let q = secToQ(tSec) % loopQ();
      let lenQ = secToQ(sg.n * hop / sr);
      if ($("quantize").checked) {
        q = Math.round(q / stepQ()) * stepQ();
        lenQ = Math.max(stepQ(), Math.round(lenQ / stepQ()) * stepQ());
      }
      if (q < 0 || q >= loopQ()) continue;
      let best = keys[0], bd = 1e9;                     // land it on a makam pitch
      for (const k of keys) {
        if (state.smart && !k.inScale) continue;
        const dist = Math.abs(Math.log2(sg.f / keyFreq(k)));
        if (dist < bd) { bd = dist; best = k; }
      }
      if (bd > 0.5) continue;                           // more than a fifth out, skip it
      added.push({ q, lenQ, f: keyFreq(best), midi: best.midi, vel: 0.9 });
    }
    state.notes = state.notes.concat(added);
    updateNoteCount();
    renderRoll();
    st.textContent = added.length ? added.length + " " + t("notesFound") : t("noMelody");
  }, 30);
}

/* ---------- file analysis: pull the rhythm out of a recording ---------- */

// Iterative radix-2 FFT, in place on separate real and imaginary arrays.
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

function medianOf(arr, from, to) {
  const tmp = arr.slice(Math.max(0, from), Math.min(arr.length, to));
  tmp.sort((a, b) => a - b);
  return tmp[tmp.length >> 1] || 0;
}

/* Builds a magnitude spectrogram, suppresses the tonal part by taking a median
   across frequency (the percussive half of an HPSS split), and reads the
   onsets out of what is left. Analyses the first 30 seconds only. */
function analyseRhythm(buffer) {
  const SRA = 22050, WIN = 1024, HOP = 256, BINS = WIN / 2;
  const src = buffer.getChannelData(0);
  const ratio = buffer.sampleRate / SRA;
  const total = Math.floor(Math.min(buffer.duration, 30) * SRA);
  const d = new Float32Array(total);
  for (let i = 0; i < total; i++) d[i] = src[Math.floor(i * ratio)] || 0;

  const frames = Math.max(1, Math.floor((d.length - WIN) / HOP));
  const hann = new Float32Array(WIN);
  for (let i = 0; i < WIN; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / WIN);

  const mag = [], perc = [];
  const re = new Float32Array(WIN), im = new Float32Array(WIN);
  for (let f = 0; f < frames; f++) {
    const off = f * HOP;
    for (let i = 0; i < WIN; i++) { re[i] = d[off + i] * hann[i]; im[i] = 0; }
    fft(re, im);
    const m = new Float32Array(BINS);
    for (let k = 0; k < BINS; k++) m[k] = Math.hypot(re[k], im[k]);
    mag.push(m);
    // median across frequency keeps transients and flattens held tones
    const p = new Float32Array(BINS);
    for (let k = 0; k < BINS; k++) p[k] = Math.min(m[k], medianOf(m, k - 8, k + 9) * 2.2);
    perc.push(p);
  }

  // onset envelope from the positive spectral flux of the percussive part
  const env = new Float32Array(frames);
  for (let f = 1; f < frames; f++) {
    let sum = 0;
    for (let k = 1; k < BINS; k++) {
      const diff = perc[f][k] - perc[f - 1][k];
      if (diff > 0) sum += diff;
    }
    env[f] = sum;
  }
  let mx = 0;
  for (const v of env) if (v > mx) mx = v;
  if (mx > 0) for (let i = 0; i < frames; i++) env[i] /= mx;

  // tempo from the autocorrelation of that envelope, inside 60-180 BPM
  const fps = SRA / HOP;
  let bestLag = 0, bestVal = 0;
  for (let lag = Math.floor(fps * 60 / 180); lag <= Math.ceil(fps * 60 / 60); lag++) {
    let acc = 0;
    for (let i = 0; i + lag < frames; i++) acc += env[i] * env[i + lag];
    acc /= (frames - lag) || 1;
    if (acc > bestVal) { bestVal = acc; bestLag = lag; }
  }
  const bpm = bestLag ? Math.max(60, Math.min(180, Math.round(60 * fps / bestLag))) : 100;

  // pick peaks that stand clear of their neighbourhood
  const onsets = [];
  for (let f = 2; f < frames - 2; f++) {
    const v = env[f];
    if (v < 0.08) continue;
    if (v <= env[f - 1] || v < env[f + 1]) continue;
    let local = 0;
    for (let i = Math.max(0, f - 20); i < Math.min(frames, f + 20); i++) local += env[i];
    local /= Math.min(frames, f + 20) - Math.max(0, f - 20);
    if (v < local * 1.6) continue;
    if (onsets.length && (f - onsets[onsets.length - 1].f) < 4) continue;

    // which band carries the hit decides which drum it becomes
    const m = mag[f];
    let lo = 0, mid = 0, hi = 0;
    for (let k = 1; k < BINS; k++) {
      const hz = k * SRA / WIN;
      if (hz < 180) lo += m[k];
      else if (hz < 1800) mid += m[k];
      else hi += m[k];
    }
    const band = lo >= mid && lo >= hi ? "doum" : hi > mid * 1.25 ? "tekhi" : "tek";
    onsets.push({ f, t: f * HOP / SRA, band, v });
  }
  return { bpm, onsets, duration: d.length / SRA };
}

function rhythmFromFile() {
  if (!state.fileBuf) return;
  const st = $("fileStatus");
  st.textContent = t("analysing");
  setTimeout(() => {
    try {
      const res = analyseRhythm(state.fileBuf);
      if (!res.onsets.length) { st.textContent = t("noRhythm"); return; }
      if (state.playing) stopPlayback();
      state.bpm = res.bpm;
      $("bpm").value = $("bpmRange").value = state.bpm;

      for (const row of DRUM_ROWS) state.grid[row].fill(0);
      const steps = totalSteps(), sd = stepDur();
      let placed = 0;
      for (const o of res.onsets) {
        const step = Math.round(o.t / sd) % steps;
        if (state.grid[o.band][step]) continue;
        state.grid[o.band][step] = o.v > 0.45 ? 2 : o.v > 0.18 ? 1 : 3;
        placed++;
      }
      renderGrid();
      renderRoll();
      st.textContent = res.bpm + " BPM, " + placed + " " + t("hitsFound");
    } catch (e) {
      st.textContent = t("failed") + e.message;
    }
  }, 30);
}

/* ---------- demo pieces ---------- */

function fillDemos() {
  const sel = $("demoSel");
  sel.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = t("demoPick");
  sel.appendChild(first);
  const groups = {};
  for (const d of (window.DEMOS || [])) (groups[d.makam] = groups[d.makam] || []).push(d);
  for (const [makam, list] of Object.entries(groups)) {
    const g = document.createElement("optgroup");
    g.label = makam;
    for (const d of list) {
      const o = document.createElement("option");
      o.value = d.id;
      o.textContent = d[lang] || d.tr;
      g.appendChild(o);
    }
    sel.appendChild(g);
  }
}

function loadDemo(id) {
  const d = (window.DEMOS || []).find(x => x.id === id);
  if (!d) return;
  if (state.playing) stopPlayback();
  state.makam = d.makam;
  state.usul = USULS[d.usul] ? d.usul : state.usul;
  state.bars = d.bars;
  state.bpm = d.bpm;
  state.tonic = d.tonic;
  state.smart = true;
  state.swing = 0;
  state.muted = new Set();
  initGrid(true);
  buildKeys();
  state.notes = d.notes.map(([q, cents, len]) => {
    const f = d.tonic * Math.pow(2, cents / 1200);
    let best = keys[0], bd = 1e9;
    for (const k of keys) {
      const dist = Math.abs(Math.log2(f / k.freq));
      if (dist < bd) { bd = dist; best = k; }
    }
    return { q, f, midi: best.midi, vel: 0.9, lenQ: Math.max(0.05, len) };
  });
  syncControls();
  updateWheelText();
  $("exportStatus").textContent = t("demoLoaded");
  initAudio().then(() => { if (!state.playing) startPlayback(); });
}

/* ---------- Camelot wheel ---------- */

const tonicName = () => (TONICS.find(x => Math.abs(x[1] - state.tonic) < 0.01) || TONICS[2])[0];
const isMajorish = () => MAKAMS[state.makam].mood === "happy";

function currentCode() {
  const root = tonicName();
  return isMajorish() ? { n: CAMELOT_B[root], l: "B" } : { n: CAMELOT_A[root], l: "A" };
}

function compatibleCodes() {
  const c = currentCode();
  const wrap = n => ((n - 1 + 12) % 12) + 1;
  return [{ n: c.n, l: c.l === "A" ? "B" : "A" },
          { n: wrap(c.n - 1), l: c.l }, { n: wrap(c.n + 1), l: c.l }];
}

function arcPath(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
}

function renderWheel() {
  const svg = $("wheel");
  if (!svg) return;
  const S = 300, c = S / 2;
  const cur = currentCode(), fit = compatibleCodes();
  const isCur = (n, l) => cur.n === n && cur.l === l;
  const isFit = (n, l) => fit.some(f => f.n === n && f.l === l);

  let out = "";
  for (let i = 0; i < 12; i++) {
    const n = i + 1;
    const a0 = ((i * 30) - 90 - 15) * Math.PI / 180;
    const a1 = (((i + 1) * 30) - 90 - 15) * Math.PI / 180;
    const am = (a0 + a1) / 2;
    for (const [l, r0, r1, rt] of [["B", 96, 140, 118], ["A", 50, 94, 72]]) {
      const cls = isCur(n, l) ? "seg cur" : isFit(n, l) ? "seg fit" : "seg";
      out += `<path class="${cls}" d="${arcPath(c, c, r0, r1, a0, a1)}" data-n="${n}" data-l="${l}"></path>`;
      out += `<text class="segtxt" x="${c + rt * Math.cos(am)}" y="${c + rt * Math.sin(am) + 4}">${n}${l}</text>`;
    }
  }
  svg.innerHTML = out;
  svg.querySelectorAll(".seg").forEach(p => p.addEventListener("click", () => {
    const n = +p.dataset.n, l = p.dataset.l;
    const root = l === "A" ? A_ROOT[n] : B_ROOT[n];
    const entry = TONICS.find(x => x[0] === root);
    if (entry) state.tonic = entry[1];
    const wantHappy = l === "B";
    if (isMajorish() !== wantHappy)
      state.makam = Object.keys(MAKAMS).find(m => (MAKAMS[m].mood === "happy") === wantHappy) || state.makam;
    $("shift").value = state.tonic;
    $("makam").value = state.makam;
    renderKeys();
    updateWheelText();
  }));
  updateWheelText();
}

function updateWheelText() {
  const cur = currentCode();
  $("wheelNow").textContent = t("wheelNow") + ": " + cur.n + cur.l + " (" + tonicName() + " " + state.makam + ")";
  $("wheelFit").textContent = t("wheelFit") + ": " + compatibleCodes().map(f => f.n + f.l).join(", ");
  $("makamUse").textContent = t("makamUse")[state.makam] || "";
  renderWheelSegments();
}

function renderWheelSegments() {
  const svg = $("wheel");
  if (!svg) return;
  const cur = currentCode(), fit = compatibleCodes();
  svg.querySelectorAll(".seg").forEach(p => {
    const n = +p.dataset.n, l = p.dataset.l;
    p.classList.toggle("cur", cur.n === n && cur.l === l);
    p.classList.toggle("fit", fit.some(f => f.n === n && f.l === l));
  });
}

/* ---------- shareable link: the whole loop lives in the URL, no server ---------- */

function bytesToUrl(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function urlToBytes(s) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function encodeState() {
  const steps = totalSteps(), gridBytes = Math.ceil(steps / 4);
  const b = [];
  b.push(1, Math.round(state.bpm) - 60,
    Object.keys(USULS).indexOf(state.usul), state.bars, Math.round(state.swing * 100),
    Object.keys(MAKAMS).indexOf(state.makam),
    Math.max(0, TONICS.findIndex(x => Math.abs(x[1] - state.tonic) < 0.01)),
    (state.smart ? 1 : 0) | (state.strings === "plastic" ? 2 : 0), steps);
  let mask = 0;
  DRUM_ROWS.forEach((r, i) => { if (state.muted.has(r)) mask |= 1 << i; });
  b.push(mask & 255, (mask >> 8) & 255);
  for (const row of DRUM_ROWS)
    for (let i = 0; i < gridBytes; i++) {
      let v = 0;
      for (let k = 0; k < 4; k++) {
        const idx = i * 4 + k;
        if (idx < steps) v |= (state.grid[row][idx] & 3) << (k * 2);
      }
      b.push(v);
    }
  const notes = state.notes.slice(0, 255);
  const tick = stepQ() / 4;
  b.push(notes.length);
  for (const n of notes) {
    const ti = Math.round(n.q / tick);
    b.push(ti & 255, (ti >> 8) & 255, n.midi & 127,
      Math.round(Math.min(1, n.vel || 0.9) * 127),
      Math.max(1, Math.min(255, Math.round((n.lenQ || stepQ()) / tick))));
  }
  return bytesToUrl(Uint8Array.from(b));
}

function decodeState(str) {
  const b = urlToBytes(str);
  let p = 0;
  if (b[p++] !== 1) throw new Error("version");
  state.bpm = b[p++] + 60;
  state.usul = Object.keys(USULS)[b[p++]] || state.usul;
  state.bars = b[p++] || 2;
  state.swing = b[p++] / 100;
  state.makam = Object.keys(MAKAMS)[b[p++]] || state.makam;
  state.tonic = (TONICS[b[p++]] || TONICS[1])[1];
  const flags = b[p++];
  state.smart = !!(flags & 1);
  state.strings = flags & 2 ? "plastic" : "metal";
  const steps = b[p++];
  const mask = b[p++] | (b[p++] << 8);
  state.muted = new Set(DRUM_ROWS.filter((r, i) => mask & (1 << i)));

  initGrid(false);
  const gridBytes = Math.ceil(steps / 4);
  for (const row of DRUM_ROWS)
    for (let i = 0; i < gridBytes; i++) {
      const v = b[p++];
      for (let k = 0; k < 4; k++) {
        const idx = i * 4 + k;
        if (idx < steps && idx < state.grid[row].length) state.grid[row][idx] = (v >> (k * 2)) & 3;
      }
    }
  const count = b[p++];
  const tick = stepQ() / 4;
  buildKeys();
  state.notes = [];
  for (let i = 0; i < count; i++) {
    const ti = b[p] | (b[p + 1] << 8); p += 2;
    const midi = b[p++], vel = b[p++] / 127, len = b[p++];
    const k = keys.find(x => x.midi === midi) || keys[0];
    state.notes.push({ q: ti * tick, midi, vel, lenQ: len * tick, f: keyFreq(k) });
  }
}

function syncControls() {
  $("bpm").value = $("bpmRange").value = state.bpm;
  $("usul").value = state.usul;
  $("bars").value = state.bars;
  $("swing").value = state.swing;
  $("makam").value = state.makam;
  $("shift").value = state.tonic;
  $("smart").checked = state.smart;
  $("strings").value = state.strings;
  if (nodes) {
    const metalOn = state.strings === "metal";
    nodes.metal.gain.value = metalOn ? 1 : 0;
    nodes.plastic.gain.value = metalOn ? 0 : 1;
  }
  renderGrid();
  renderKeys();
  updateWheelText();
  updateNoteCount();
}

async function shareLink() {
  const url = location.origin + location.pathname + "#p=" + encodeState();
  history.replaceState(null, "", url);
  try {
    await navigator.clipboard.writeText(url);
    $("exportStatus").textContent = t("linkCopied");
  } catch (e) {
    $("exportStatus").textContent = t("linkFail");
  }
}

function loadFromHash() {
  if (!location.hash.startsWith("#p=")) return false;
  try {
    decodeState(location.hash.slice(3));
    syncControls();
    $("exportStatus").textContent = t("linkLoaded");
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------- vertical video for Reels and Shorts ---------- */

function pickVideoMime() {
  if (!window.MediaRecorder) return null;
  const cands = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4",
                 "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  for (const c of cands) if (MediaRecorder.isTypeSupported(c)) return c;
  return null;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const rr = Math.min(typeof r === "number" ? r : 0, w / 2, h / 2);
    this.moveTo(x + rr, y);
    this.arcTo(x + w, y, x + w, y + h, rr);
    this.arcTo(x + w, y + h, x, y + h, rr);
    this.arcTo(x, y + h, x, y, rr);
    this.arcTo(x, y, x + w, y, rr);
    this.closePath();
    return this;
  };
}

function voiceEnvelope(buf, n) {
  const d = buf.getChannelData(0), out = new Float32Array(n);
  const step = Math.max(1, Math.floor(d.length / n));
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let j = 0; j < step; j++) {
      const v = Math.abs(d[i * step + j] || 0);
      if (v > m) m = v;
    }
    out[i] = m;
  }
  return out;
}

function drawMicBadge(cx, x, y, r, level, col) {
  cx.save();
  cx.beginPath();
  cx.arc(x, y, r + level * 10, 0, Math.PI * 2);
  cx.fillStyle = col.accent;
  cx.globalAlpha = 0.18 + level * 0.3;
  cx.fill();
  cx.globalAlpha = 1;
  cx.beginPath();
  cx.arc(x, y, r, 0, Math.PI * 2);
  cx.fillStyle = level > 0.04 ? col.accent : col.panel;
  cx.fill();
  // mic capsule and stand
  cx.fillStyle = level > 0.04 ? "#fff" : col.muted;
  const cw = r * 0.42, ch = r * 0.66;
  cx.beginPath();
  cx.roundRect(x - cw / 2, y - ch * 0.75, cw, ch, cw / 2);
  cx.fill();
  cx.strokeStyle = cx.fillStyle;
  cx.lineWidth = r * 0.11;
  cx.beginPath();
  cx.arc(x, y - ch * 0.1, cw * 0.86, 0.15 * Math.PI, 0.85 * Math.PI);
  cx.stroke();
  cx.beginPath();
  cx.moveTo(x, y + ch * 0.62);
  cx.lineTo(x, y + ch * 0.86);
  cx.stroke();
  cx.restore();
}

// Instagram and TikTok cover the edges of a 9:16 frame with their own interface,
// so everything that matters is laid out inside this box.
const SAFE = { l: 56, r: 150, t: 170, b: 290 };
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function drawVideoFrame(cx, W, H, pos, env) {
  const col = {
    bg: cssVar("--bg"), bg2: cssVar("--bg2"), panel: cssVar("--panel"),
    panel2: cssVar("--panel2"), panel3: cssVar("--panel3"), ink: cssVar("--ink"),
    ink2: cssVar("--ink2"), muted: cssVar("--muted"), accent: cssVar("--accent"),
    accent2: cssVar("--accent2"), soft: cssVar("--soft")
  };
  const X = SAFE.l, CW = W - SAFE.l - SAFE.r, CX = X + CW / 2;

  // full-bleed background so the raw file never looks cropped
  const g = cx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, col.bg2);
  g.addColorStop(0.55, col.bg);
  g.addColorStop(1, col.bg2);
  cx.fillStyle = g;
  cx.fillRect(0, 0, W, H);
  cx.save();
  cx.globalAlpha = 0.05;
  cx.fillStyle = col.accent;
  cx.beginPath(); cx.arc(W * 0.82, H * 0.12, 260, 0, Math.PI * 2); cx.fill();
  cx.beginPath(); cx.arc(W * 0.1, H * 0.9, 300, 0, Math.PI * 2); cx.fill();
  cx.restore();

  // header
  cx.textAlign = "left";
  cx.fillStyle = col.muted;
  cx.font = "600 20px " + FONT;
  cx.letterSpacing = "4px";
  cx.fillText("CK MAKAM", X, SAFE.t);
  cx.letterSpacing = "0px";

  cx.fillStyle = col.ink;
  cx.font = "700 62px " + FONT;
  cx.fillText(state.makam, X, SAFE.t + 72);

  // usul and tempo as chips
  let chipX = X;
  const chip = (text, fill, textCol) => {
    cx.font = "600 22px " + FONT;
    const w = cx.measureText(text).width + 30;
    cx.fillStyle = fill;
    cx.beginPath();
    cx.roundRect(chipX, SAFE.t + 96, w, 40, 20);
    cx.fill();
    cx.fillStyle = textCol;
    cx.fillText(text, chipX + 15, SAFE.t + 123);
    chipX += w + 10;
  };
  chip(state.usul.replace(/\s*\((.*)\)/, " $1"), col.panel3, col.ink2);
  chip(Math.round(state.bpm) + " BPM", col.panel3, col.ink2);
  if (state.voice) chip(t("voice"), col.accent, "#fff");

  // piano roll card
  const ry = SAFE.t + 170, rh = 350, pad = 14;
  cx.fillStyle = col.panel;
  cx.beginPath(); cx.roundRect(X, ry, CW, rh, 22); cx.fill();
  const iy = ry + pad, ih = rh - pad * 2, ix = X + pad, iw = CW - pad * 2;
  cx.save();
  cx.beginPath(); cx.roundRect(ix, iy, iw, ih, 12); cx.clip();
  cx.fillStyle = col.bg2;
  cx.fillRect(ix, iy, iw, ih);

  const lanes = rollKeys.length || keys.length;
  const src = rollKeys.length ? rollKeys : keys;
  const lh = ih / lanes;
  for (let i = 0; i < lanes; i++) {
    const k = src[lanes - 1 - i];
    if (k && !k.white) { cx.fillStyle = "rgba(0,0,0,0.3)"; cx.fillRect(ix, iy + i * lh, iw, lh); }
  }
  const playX = ix + iw * 0.34, pps = iw / loopDur();
  for (const n of state.notes) {
    const idx = src.findIndex(k => k.midi === n.midi);
    if (idx < 0) continue;
    const li = lanes - 1 - idx;
    for (const off of [-1, 0, 1]) {
      const x = playX + (qToSec(n.q) + off * loopDur() - pos) * pps;
      const w = Math.max(7, qToSec(n.lenQ || stepQ()) * pps - 2);
      if (x > ix + iw || x + w < ix) continue;
      const live = x <= playX && x + w >= playX;
      cx.fillStyle = live ? col.accent2 : col.accent;
      cx.beginPath();
      cx.roundRect(x, iy + li * lh + 1.5, w, Math.max(3, lh - 3), 3);
      cx.fill();
    }
  }
  cx.fillStyle = col.ink;
  cx.globalAlpha = 0.9;
  cx.fillRect(playX - 1.5, iy, 3, ih);
  cx.restore();

  // drum pads
  const steps = totalSteps(), cur = Math.floor(pos / stepDur()) % steps;
  const used = DRUM_ROWS.filter(r => !state.muted.has(r) && state.grid[r].some(v => v)).slice(0, 4);
  const dy = ry + rh + 34, padH = 30, gap = 11, labelW = 132;
  cx.textAlign = "left";
  used.forEach((row, i) => {
    const y = dy + i * (padH + gap);
    cx.fillStyle = col.muted;
    cx.font = "600 19px " + FONT;
    cx.fillText(I18N[lang].drums[row], X, y + 21);
    const bx = X + labelW, bw = CW - labelW, cw = bw / steps;
    for (let s = 0; s < steps; s++) {
      const v = state.grid[row][s];
      cx.fillStyle = !v ? col.panel2
        : s === cur ? col.ink
        : v === 2 ? col.accent2 : v === 3 ? col.soft : col.accent;
      cx.beginPath();
      cx.roundRect(bx + s * cw + 1.5, y, cw - 3, padH, 5);
      cx.fill();
    }
  });

  // voice band, so the viewer can see the person's own take arrive
  if (env && state.voice) {
    const vy = dy + used.length * (padH + gap) + 26, vh = 72;
    const vp = pos - qToSec(state.voiceOffsetQ);
    const dur = state.voice.duration;
    const inside = vp >= 0 && vp <= dur;
    const level = inside ? env[Math.min(env.length - 1, Math.floor(vp / dur * env.length))] : 0;

    cx.fillStyle = col.panel;
    cx.beginPath(); cx.roundRect(X, vy, CW, vh, 16); cx.fill();
    drawMicBadge(cx, X + 42, vy + vh / 2, 23, level, col);

    const wx = X + 84, ww = CW - 100, half = vh / 2;
    for (let i = 0; i < env.length; i++) {
      const x = wx + (i / env.length) * ww;
      const h2 = Math.max(1.5, env[i] * (vh * 0.38));
      const past = inside && (i / env.length) <= vp / dur;
      cx.fillStyle = past ? col.accent2 : col.panel3;
      cx.fillRect(x, vy + half - h2, Math.max(1.5, ww / env.length - 1), h2 * 2);
    }
    if (inside) {
      cx.fillStyle = col.ink;
      cx.fillRect(wx + (vp / dur) * ww, vy + 10, 2, vh - 20);
    }
  }

  // footer lockup, still inside the safe box
  const fy = H - SAFE.b;
  cx.fillStyle = col.accent;
  cx.beginPath(); cx.roundRect(X, fy - 20, 8, 28, 4); cx.fill();
  cx.fillStyle = col.ink2;
  cx.font = "600 24px " + FONT;
  cx.fillText("cemilkocan.github.io/ck-makam", X + 22, fy);
}

async function exportVideo() {
  const status = $("exportStatus");
  const mime = pickVideoMime();
  if (!mime) { status.textContent = t("videoNo"); return; }
  await initAudio();
  if (state.playing) stopPlayback();

  let repeats = parseInt($("repeats").value, 10);
  while (loopDur() * repeats > 35 && repeats > 1) repeats--;
  status.textContent = t("rendering");
  const buf = await renderOffline(repeats, { drums: true, baglama: true, voice: true });

  const canvas = document.createElement("canvas");
  canvas.width = 720; canvas.height = 1280;
  const cx = canvas.getContext("2d");
  const env = state.voice ? voiceEnvelope(state.voice, 160) : null;
  drawVideoFrame(cx, canvas.width, canvas.height, 0, env);

  const ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
  const dest = ac.createMediaStreamDestination();
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.connect(dest);
  src.connect(ac.destination);

  const vs = canvas.captureStream(30);
  const stream = new MediaStream([...vs.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5000000 });
  const chunks = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const finished = new Promise(r => { rec.onstop = r; });

  status.textContent = t("videoRec");
  rec.start();
  const t0 = ac.currentTime + 0.15;
  src.start(t0);

  await new Promise(resolve => {
    const tick = () => {
      const p = ac.currentTime - t0;
      if (p >= buf.duration - 0.25) { resolve(); return; }
      drawVideoFrame(cx, canvas.width, canvas.height, Math.max(0, p) % loopDur(), env);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  rec.stop();
  await finished;
  try { src.stop(); } catch (e) {}
  ac.close();
  const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
  download(new Blob(chunks, { type: mime }), "ck-makam-" + stamp() + "." + ext);
  status.textContent = t("done");
  setTimeout(() => { if (status.textContent === t("done")) status.textContent = ""; }, 4000);
}

/* ---------- project files ---------- */

function saveProject() {
  const data = {
    v: 1, bpm: state.bpm, usul: state.usul, bars: state.bars, swing: state.swing,
    makam: state.makam, tonic: state.tonic, smart: state.smart, strings: state.strings,
    notes: state.notes, muted: [...state.muted],
    voiceOffsetQ: state.voiceOffsetQ, fx: state.fx,
    grid: Object.fromEntries(DRUM_ROWS.map(r => [r, Array.from(state.grid[r])]))
  };
  download(new Blob([JSON.stringify(data)], { type: "application/json" }),
           "ck-makam-" + stamp() + ".ckm.json");
}

function loadProject(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      if (state.playing) stopPlayback();
      state.bpm = d.bpm || 100;
      state.usul = USULS[d.usul] ? d.usul : state.usul;
      state.bars = d.bars || 2;
      state.swing = d.swing || 0;
      state.makam = MAKAMS[d.makam] ? d.makam : state.makam;
      state.tonic = d.tonic || 220;
      state.smart = !!d.smart;
      state.strings = d.strings || "metal";
      state.notes = (Array.isArray(d.notes) ? d.notes : []).map(n => ({
        q: n.q !== undefined ? n.q : secToQ(n.t || 0),
        lenQ: n.lenQ !== undefined ? n.lenQ : (n.len !== undefined ? secToQ(n.len) : stepQ()),
        f: n.f, midi: n.midi, vel: n.vel
      }));
      state.voiceOffsetQ = d.voiceOffsetQ || 0;
      if (d.fx) state.fx = Object.assign(state.fx, d.fx);
      voiceBaseQ = state.voiceOffsetQ;
      state.muted = new Set(d.muted || []);
      initGrid(false);
      for (const r of DRUM_ROWS)
        if (d.grid && d.grid[r]) state.grid[r] = Uint8Array.from(d.grid[r].slice(0, totalSteps()));
      $("bpm").value = $("bpmRange").value = state.bpm;
      $("usul").value = state.usul;
      $("bars").value = state.bars;
      $("swing").value = state.swing;
      $("makam").value = state.makam;
      $("shift").value = state.tonic;
      $("smart").checked = state.smart;
      $("strings").value = state.strings;
      if (nodes) {
        const metalOn = state.strings === "metal";
        nodes.metal.gain.value = metalOn ? 1 : 0;
        nodes.plastic.gain.value = metalOn ? 0 : 1;
      }
      renderGrid(); renderKeys(); updateNoteCount();
      $("exportStatus").textContent = t("loaded");
    } catch (err) {
      $("exportStatus").textContent = t("failed") + err.message;
    }
  };
  fr.readAsText(file);
}

/* ---------- tooltips ---------- */

function showTip(btn, text) {
  const tip = $("tip");
  tip.textContent = text;
  tip.hidden = false;
  const r = btn.getBoundingClientRect();
  const w = Math.min(text.length > 300 ? 460 : 320, window.innerWidth - 24);
  tip.style.width = w + "px";
  tip.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + "px";
  tip.style.top = r.bottom + window.scrollY + 8 + "px";
  clearTimeout(tipTimer);
  tipTimer = setTimeout(hideTip, 8000);
}

function hideTip() {
  clearTimeout(tipTimer);
  const tip = $("tip");
  if (tip) tip.hidden = true;
}

function wireHelp(btnId, getText) {
  const b = $(btnId), tip = $("tip");
  b.addEventListener("click", e => {
    e.stopPropagation();
    const open = !tip.hidden && tip.dataset.from === btnId;
    if (open) { hideTip(); return; }
    tip.dataset.from = btnId;
    showTip(b, getText());
  });
  b.addEventListener("pointerenter", () => {
    if (!wideScreen()) return;
    tip.dataset.from = btnId;
    showTip(b, getText());
  });
  b.addEventListener("pointerleave", () => {
    if (!wideScreen()) return;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(hideTip, 500);
  });
}

/* ---------- first-run tour ---------- */

// Each tour step points at the control it is talking about.
const TOUR_TARGETS = ["#play", "#grid", "#usul", "#makam", "#rec", ".export-row"];

function showTour(step) {
  tourStep = Math.max(0, Math.min(step, t("tour").length - 1));
  const [title, body] = t("tour")[tourStep];
  $("tourTitle").textContent = title;
  $("tourText").textContent = body;
  $("tourStep").textContent = (tourStep + 1) + " / " + t("tour").length;
  $("tourPrev").disabled = tourStep === 0;
  $("tourNext").textContent = tourStep === t("tour").length - 1 ? t("tourDone") : t("tourNext");
  $("tour").hidden = false;
  if ($("drumBody").hidden && ["#grid", "#usul"].includes(TOUR_TARGETS[tourStep])) setCollapsed(false);
  requestAnimationFrame(() => placeTour(TOUR_TARGETS[tourStep]));
}

function placeTour(sel) {
  const el = sel && document.querySelector(sel);
  const spot = $("spot"), box = $("tourBox");
  if (!el) {
    spot.hidden = true;
    box.style.top = Math.max(16, (window.innerHeight - box.offsetHeight) / 2) + "px";
    box.style.left = Math.max(12, (window.innerWidth - box.offsetWidth) / 2) + "px";
    return;
  }
  el.scrollIntoView({ block: "center", inline: "nearest" });
  requestAnimationFrame(() => {
    const r = el.getBoundingClientRect(), pad = 8;
    spot.hidden = false;
    spot.style.left = r.left - pad + "px";
    spot.style.top = r.top - pad + "px";
    spot.style.width = r.width + pad * 2 + "px";
    spot.style.height = r.height + pad * 2 + "px";

    const bw = box.offsetWidth, bh = box.offsetHeight;
    let top = r.bottom + 18;
    if (top + bh > window.innerHeight - 12) top = r.top - bh - 18;
    if (top < 12) top = Math.min(window.innerHeight - bh - 12, Math.max(12, r.bottom + 18));
    box.style.top = top + "px";
    box.style.left = Math.max(12, Math.min(window.innerWidth - bw - 12, r.left + r.width / 2 - bw / 2)) + "px";
  });
}

function closeTour() {
  $("tour").hidden = true;
  $("spot").hidden = true;
  try { localStorage.setItem("ckm_tour", "done"); } catch (e) {}
}

/* ---------- UI wiring ---------- */

function fillSelect(sel, items, selected) {
  sel.innerHTML = "";
  for (const it of items) {
    const o = document.createElement("option");
    o.value = Array.isArray(it) ? it[1] : it;
    o.textContent = Array.isArray(it) ? it[0] : it;
    if (o.value == selected) o.selected = true;
    sel.appendChild(o);
  }
}

function fillMakams() {
  const sel = $("makam");
  sel.innerHTML = "";
  for (const [name, m] of Object.entries(MAKAMS)) {
    const o = document.createElement("option");
    o.value = name;
    o.textContent = name + " (" + t("moods")[m.mood] + ")";
    if (name === state.makam) o.selected = true;
    sel.appendChild(o);
  }
}

function renderLegend() {
  const items = [["normal", "normalT"], ["strong", "strongT"], ["soft", "softT"], ["off", "offT"]];
  $("legend").innerHTML = items.map(([k, tip]) =>
    '<span class="lg" title="' + t(tip) + '"><span class="sw ' + k + '"></span>' + t(k) + "</span>"
  ).join("");
}

function setCollapsed(on) {
  $("drumBody").hidden = on;
  $("collapseBtn").textContent = on ? "\u25B8" : "\u25BE";
  $("collapseBtn").title = on ? t("expand") : t("collapse");
  $("collapseBtn").setAttribute("aria-label", on ? t("expand") : t("collapse"));
  $("collapseBtn").setAttribute("aria-expanded", String(!on));
  try { localStorage.setItem("ckm_drums", on ? "hidden" : "shown"); } catch (e) {}
}

// The wheel is a side topic, so it stays folded away until someone asks for it.
function setWheel(on) {
  $("wheelBody").hidden = !on;
  $("wheelToggle").textContent = on ? "\u25BE" : "\u25B8";
  $("wheelToggle").title = on ? t("collapse") : t("expand");
  $("wheelToggle").setAttribute("aria-label", on ? t("collapse") : t("expand"));
  $("wheelToggle").setAttribute("aria-expanded", String(on));
  try { localStorage.setItem("ckm_wheel", on ? "shown" : "hidden"); } catch (e) {}
  if (on) renderWheel();
}

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  $("lang").textContent = lang === "tr" ? "EN" : "TR";
  const s = $("strings");
  s.innerHTML = "";
  for (const v of ["metal", "plastic"]) {
    const o = document.createElement("option");
    o.value = v; o.textContent = t(v);
    if (v === state.strings) o.selected = true;
    s.appendChild(o);
  }
  const inst = $("instSel");
  inst.innerHTML = "";
  for (const v of ["baglama", "kanun", "ney"]) {
    const o = document.createElement("option");
    o.value = v; o.textContent = t(v);
    if (v === state.inst) o.selected = true;
    inst.appendChild(o);
  }
  $("instTitle").textContent = t(state.inst);
  $("rec").textContent = state.recording ? t("recording") : t("record");
  for (const k of ["learnKomaT", "learnCamelotT", "learnKoma", "learnCamelot"])
    $(k).textContent = t(k);
  $("tourSkip").textContent = t("tourSkip");
  $("tourPrev").textContent = t("tourPrev");
  setPlayIcon();
  setCollapsed($("drumBody").hidden);
  setWheel(!$("wheelBody").hidden);
  fillMakams();
  fillDemos();
  renderLegend();
  renderGrid();
  renderKeys();
  renderWheel();
  updateNoteCount();
  if (!$("tour").hidden) showTour(tourStep);
}

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  $("themeSel").value = theme;
}

function init() {
  fillSelect($("usul"), Object.keys(USULS), state.usul);
  fillSelect($("shift"), TONICS, state.tonic);
  fillSelect($("themeSel"), Object.entries(THEMES).map(([k, v]) => [v, k]), theme);

  applyTheme();
  initGrid(true);
  let collapsed = false, wheelOpen = false;
  try {
    collapsed = localStorage.getItem("ckm_drums") === "hidden";
    wheelOpen = localStorage.getItem("ckm_wheel") === "shown";
  } catch (e) {}
  $("drumBody").hidden = collapsed;
  $("wheelBody").hidden = !wheelOpen;
  applyLang();

  const blur = e => e.target.blur();

  $("play").addEventListener("click", async () => {
    await initAudio();
    state.playing ? stopPlayback() : startPlayback();
  });
  $("bpm").addEventListener("input", e => {
    state.bpm = Math.min(180, Math.max(60, +e.target.value || 100));
    $("bpmRange").value = state.bpm;
    if (nodes) nodes.delay.delayTime.value = Math.min(1.2, stepDur() * 2);
    resyncTransport();
  });
  $("bpmRange").addEventListener("input", e => {
    state.bpm = +e.target.value;
    $("bpm").value = state.bpm;
    if (nodes) nodes.delay.delayTime.value = Math.min(1.2, stepDur() * 2);
    resyncTransport();
  });
  $("swing").addEventListener("input", e => { state.swing = +e.target.value; });
  $("lang").addEventListener("click", () => {
    lang = lang === "tr" ? "en" : "tr";
    try { localStorage.setItem("ckm_lang", lang); } catch (e) {}
    applyLang();
    if (midiAccess) bindMidi();
  });
  $("themeSel").addEventListener("change", e => {
    theme = e.target.value;
    try { localStorage.setItem("ckm_theme", theme); } catch (e) {}
    applyTheme();
    blur(e);
  });
  $("collapseBtn").addEventListener("click", () => setCollapsed(!$("drumBody").hidden));
  $("wheelToggle").addEventListener("click", () => setWheel($("wheelBody").hidden));
  $("usul").addEventListener("change", e => {
    if (state.playing) stopPlayback();
    state.usul = e.target.value;
    initGrid(true);
    renderRoll();
    blur(e);
  });
  $("bars").addEventListener("change", e => {
    if (state.playing) stopPlayback();
    state.bars = +e.target.value;
    initGrid(false);
    renderRoll();
    blur(e);
  });
  $("clearDrums").addEventListener("click", e => {
    for (const row of DRUM_ROWS) state.grid[row].fill(0);
    renderGrid();
    blur(e);
  });
  $("makam").addEventListener("change", e => { state.makam = e.target.value; renderKeys(); updateWheelText(); blur(e); });
  $("shift").addEventListener("change", e => { state.tonic = +e.target.value; renderKeys(); updateWheelText(); blur(e); });
  $("smart").addEventListener("change", e => { state.smart = e.target.checked; renderKeys(); });
  $("strings").addEventListener("change", e => {
    state.strings = e.target.value;
    if (nodes) {
      const metalOn = state.strings === "metal";
      nodes.metal.gain.value = metalOn ? 1 : 0;
      nodes.plastic.gain.value = metalOn ? 0 : 1;
    }
    blur(e);
  });
  $("volDrums").addEventListener("input", e => {
    state.volDrums = +e.target.value;
    if (nodes) nodes.drums.gain.value = state.volDrums;
  });
  $("volBaglama").addEventListener("input", e => {
    state.volBaglama = +e.target.value;
    if (nodes) nodes.bagOut.gain.value = state.volBaglama;
  });
  $("rec").addEventListener("click", e => { toggleRec(); blur(e); });
  $("undo").addEventListener("click", e => { state.notes.pop(); updateNoteCount(); renderRoll(); blur(e); });
  $("clearNotes").addEventListener("click", e => { state.notes = []; updateNoteCount(); renderRoll(); blur(e); });
  $("midiBtn").addEventListener("click", connectMidi);
  $("midiSel").addEventListener("change", e => { midiInputId = e.target.value; bindMidi(); blur(e); });

  wireHelp("usulHelp", () => t("usulInfo")[state.usul]);
  wireHelp("makamHelp", () => t("makamInfo")[state.makam]);
  wireHelp("smartHelp", () => t("smartHelp"));
  wireHelp("gridHelp", () => t("gridHint"));
  wireHelp("rollHelp", () => t("rollHint"));
  wireHelp("wheelHelp", () => t("wheelHelp"));
  wireHelp("uploadHelp", () => t("uploadHelp"));
  document.addEventListener("click", e => {
    if (!e.target.closest(".help") && !e.target.closest("#tip")) hideTip();
  });

  $("saveBtn").addEventListener("click", saveProject);
  $("loadBtn").addEventListener("click", () => $("loadFile").click());
  $("loadFile").addEventListener("change", e => { if (e.target.files[0]) loadProject(e.target.files[0]); });
  document.querySelectorAll("[data-export]").forEach(b =>
    b.addEventListener("click", () => doExport(b.dataset.export)));

  $("tourNext").addEventListener("click", e => {
    e.stopPropagation();
    tourStep === t("tour").length - 1 ? closeTour() : showTour(tourStep + 1);
  });
  $("tourPrev").addEventListener("click", e => { e.stopPropagation(); showTour(tourStep - 1); });
  $("tourSkip").addEventListener("click", e => { e.stopPropagation(); closeTour(); });
  $("tour").addEventListener("click", e => { if (!e.target.closest(".tourbox")) closeTour(); });
  $("helpBtn").addEventListener("click", () => showTour(0));
  $("demoSel").addEventListener("change", e => { loadDemo(e.target.value); blur(e); });
  $("instSel").addEventListener("change", e => {
    state.inst = e.target.value;
    $("instTitle").textContent = t(state.inst);
    blur(e);
  });
  $("pickFile").addEventListener("click", () => $("audioFile").click());
  $("audioFile").addEventListener("change", e => { if (e.target.files[0]) loadAudioFile(e.target.files[0]); });
  $("getRhythm").addEventListener("click", rhythmFromFile);
  $("getMelody").addEventListener("click", () => melodyToNotes(true));
  $("asLayer").addEventListener("click", fileAsLayer);
  $("toNotes").addEventListener("click", () => melodyToNotes(false));
  $("micBtn").addEventListener("click", toggleMic);
  $("micClear").addEventListener("click", clearVoice);
  $("micOffset").addEventListener("input", e => { state.voiceOffsetQ = voiceBaseQ + secToQ(+e.target.value); });
  $("volVoice").addEventListener("input", e => {
    state.volVoice = +e.target.value;
    if (nodes) nodes.voiceOut.gain.value = state.volVoice;
  });
  const fxWire = (id, key, apply) => $(id).addEventListener("input", e => {
    state.fx[key] = e.target.type === "checkbox" ? e.target.checked : +e.target.value;
    if (nodes) apply(state.fx[key]);
  });
  fxWire("fxReverb", "reverb", v => { nodes.revWet.gain.value = v; });
  fxWire("fxEcho", "echo", v => { nodes.echoWet.gain.value = v; });
  fxWire("fxChorus", "chorus", v => { nodes.chorusWet.gain.value = v; });
  fxWire("fxDrive", "drive", v => {
    nodes.driveWet.gain.value = v * 0.8;
    nodes.driveDry.gain.value = 1 - v * 0.5;
  });
  fxWire("fxBass", "bass", v => { nodes.bass.gain.value = v; });
  fxWire("fxTreble", "treble", v => { nodes.treble.gain.value = v; });
  fxWire("fxComp", "comp", v => {
    nodes.compWet.gain.value = v ? 1.5 : 0;
    nodes.compDry.gain.value = v ? 0 : 1;
  });
  fxWire("fxPhone", "phone", v => {
    nodes.phoneWet.gain.value = v ? 1.6 : 0;
    nodes.phoneDry.gain.value = v ? 0 : 1;
  });
  $("fxReset").addEventListener("click", () => {
    state.fx = { reverb: 0, echo: 0, chorus: 0, drive: 0, bass: 0, treble: 0, comp: false, phone: false };
    for (const [id, k] of [["fxReverb","reverb"],["fxEcho","echo"],["fxChorus","chorus"],
                           ["fxDrive","drive"],["fxBass","bass"],["fxTreble","treble"]])
      $(id).value = state.fx[k];
    $("fxComp").checked = false;
    $("fxPhone").checked = false;
    if (nodes) {
      nodes.revWet.gain.value = 0; nodes.echoWet.gain.value = 0; nodes.chorusWet.gain.value = 0;
      nodes.driveWet.gain.value = 0; nodes.driveDry.gain.value = 1;
      nodes.bass.gain.value = 0; nodes.treble.gain.value = 0;
      nodes.compWet.gain.value = 0; nodes.compDry.gain.value = 1;
      nodes.phoneWet.gain.value = 0; nodes.phoneDry.gain.value = 1;
    }
  });
  $("shareBtn").addEventListener("click", shareLink);
  $("videoBtn").addEventListener("click", exportVideo);

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      renderKeys();
      if (!$("tour").hidden) placeTour(TOUR_TARGETS[tourStep]);
    }, 200);
  });

  const fromLink = loadFromHash();
  let seen = false;
  try { seen = localStorage.getItem("ckm_tour") === "done"; } catch (e) {}
  if (!seen && !fromLink) showTour(0);
}

init();
