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

// Makam scales as 53-comma (AEU) step patterns from the tonic.
const MAKAMS = {
  "Hicaz":    { steps: [5, 12, 5, 9, 8, 5, 9], mood: "sad" },
  "Rast":     { steps: [9, 8, 5, 9, 9, 8, 5], mood: "happy" },
  "Çargah":   { steps: [9, 9, 4, 9, 9, 9, 4], mood: "happy" },
  "Uşşak":    { steps: [8, 5, 9, 9, 8, 5, 9], mood: "calm" },
  "Kürdi":    { steps: [4, 9, 9, 9, 4, 9, 9], mood: "sad" },
  "Hüzzam":   { steps: [5, 9, 5, 12, 5, 9, 8], mood: "sad" },
  "Nihavend": { steps: [9, 4, 9, 9, 4, 9, 9], mood: "sad" }
};

const TONICS = [["G", 196.00], ["G#", 207.65], ["A", 220.00], ["A#", 233.08],
                ["B", 246.94], ["C", 261.63], ["C#", 277.18], ["D", 293.66],
                ["D#", 311.13], ["E", 329.63], ["F", 349.23], ["F#", 369.99]];

// Camelot codes. Minor-leaning makams sit on the A ring, major-leaning ones on B.
const CAMELOT_A = { "G#": 1, "D#": 2, "A#": 3, F: 4, C: 5, G: 6, D: 7, A: 8, E: 9, B: 10, "F#": 11, "C#": 12 };
const CAMELOT_B = { B: 1, "F#": 2, "C#": 3, "G#": 4, "D#": 5, "A#": 6, F: 7, C: 8, G: 9, D: 10, A: 11, E: 12 };
const A_ROOT = Object.fromEntries(Object.entries(CAMELOT_A).map(([k, v]) => [v, k]));
const B_ROOT = Object.fromEntries(Object.entries(CAMELOT_B).map(([k, v]) => [v, k]));

const DRUM_ROWS = ["doum", "tek", "tekhi", "mid", "mute",
                   "davul_dum", "davul_tek", "bendir", "zil", "tef", "snare", "clap"];

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
    rows: { doum: "X.......", tek: "....x...", mute: ".....o.." } },
  "Karşılama (9/8)": { steps: 9, quarters: 4.5, groups: [2, 2, 2, 3],
    rows: { doum: "X...x....", tek: "..x...x.x" } },
  "Aksak (9/8)": { steps: 9, quarters: 4.5, groups: [2, 2, 2, 3],
    rows: { doum: "X...x....", tek: "......x..", mute: "..o.....o" } },
  "Düyek (8/8)": { steps: 8, quarters: 4, groups: [2, 2, 2, 2],
    rows: { doum: "X..x....", tek: "...x.x.x", mute: "....o..." } },
  "Boş (4/4)": { steps: 16, quarters: 4, groups: [4, 4, 4, 4], rows: {} }
};

const SOUND_FILES = (() => {
  const m = {};
  for (const k of Object.keys(BAGLAMA_F0)) m["bag_" + k] = "sounds/baglama/" + k + ".mp3";
  for (const s of ["doum", "tek", "tekhi", "mid", "mute"]) m[s] = "sounds/darbuka/" + s + ".wav";
  for (const s of ["davul_dum", "davul_tek", "bendir", "zil", "tef", "snare", "clap"])
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
    drums: { doum: "Düm", tek: "Tek", tekhi: "Tek tiz", mid: "Orta", mute: "Ka",
      davul_dum: "Davul düm", davul_tek: "Davul çubuk", bendir: "Bendir",
      zil: "Zil", tef: "Tef", snare: "Trampet", clap: "Alkış" },
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
      "Nihavend": "Romantik ve üzgün. Batı minörünün karşılığı."
    },
    wheel: "Camelot tekerleği", wheelNow: "Şu an", wheelFit: "Uyumlu",
    wheelHelp: "Tekerlekten bir koda tıklayınca karar sesi ve makam ona göre ayarlanır. Aşağıdaki açıklamada sistemin nasıl çalıştığı yazıyor.",
    learn: "Bunlar ne demek?",
    learnCamelot: "Camelot, tonları numara ve harfle adlandıran bir sistem. Numara sesin çemberdeki yerini, harf de rengini gösteriyor: A koyu (minör) taraf, B açık (majör) taraf. 8A la minör demek, 8B do majör demek.\n\nİşe yarar yanı şu: kendi kodunun yanındaki iki numara ve aynı numaranın diğer harfi, seninkiyle neredeyse aynı notaları paylaşır. 8A çalıyorsan 7A, 9A ve 8B'ye geçmek kulağı tırmalamaz. DJ'ler iki şarkıyı birleştirirken bunu kullanıyor ama tek bir parçanın içinde bölümden bölüme geçerken de aynısı geçerli. Türkiye'de pek bilinmiyor, oysa akordeon gibi basit bir pusula.\n\nİki hamle daha var, tekerlek göstermez: yarım ses yukarı çıkmak enerjiyi yükseltir, nakarat öncesi çok kullanılır. Aynı kökü koruyup majörden minöre düşmek de kulakta doğal durur, çünkü karar sesi değişmez.",
    learnKoma: "Batı müziğinde oktav 12 eşit yarım sese bölünür, piyanonun tuşları bunlardır. Türk makam müziğinde ise oktav 53 küçük parçaya bölünür, her birine koma denir. Bir tam ses 9 koma, yarım ses dediğimiz aralık 4 ya da 5 koma tutar.\n\nBunun sonucu şu: piyanonun iki tuşu arasına düşen, tuşu olmayan sesler vardır. Makamı makam yapan perdeler çoğunlukla oralardadır. Hicaz'ın ikinci perdesi hiçbir piyano tuşuna oturmaz, iki tuşun arasında durur. Bağlamanın gitardan çok daha fazla perdesi olmasının sebebi de budur.\n\nNeden tam 53? Saf beşli aralığını üst üste eklemeye başlarsan, 53 adım sonra neredeyse tam olarak başladığın sesin oktavına düşersin. Hata kulağın ayırt edemeyeceği kadar küçüktür. Yani 53, kulağın doğal bulduğu aralıklara en iyi oturan cetveldir. Batı bunu pratik olsun diye 12'ye yuvarladı, çünkü klavyeli bir çalgıda 53 tuş yapılamazdı. Türk müziği ince perdelerden vazgeçmek istemedi, cetveli ince tuttu. Arel-Ezgi-Uzdilek sistemi budur.\n\nBağlamada 53 perde yoktur, bir oktavda aşağı yukarı 17 ile 24 arası perde bulunur. 53 koma çalgının perde sayısı değil, ölçü birimidir.\n\nBu uygulamada hesap arka planda yapılıyor. Sen sadece makamı seçiyorsun, her nota kendi koma perdesine çekiliyor. Camelot ise majör ve minör üzerine kurulu olduğu için eşleşme yaklaşık kalıyor: Nihavend ve Çargah'ta neredeyse birebir, Hicaz ve Hüzzam'da payı geniş tut.",
    learnKomaT: "Koma perde nedir?", learnCamelotT: "Camelot nasıl okunur?",
    makamUse: {
      "Hicaz": "Arabesk, ağır romantik parçalar, dramatik giriş bölümleri. Özlem ve ayrılık anlatmak için.",
      "Rast": "Açılış parçaları, yürüyen ve umut veren bölümler. Dinleyiciyi yormaz, uzun çalınır.",
      "Çargah": "Çocuk şarkıları, marşlar, neşeli ve basit melodiler. Batı kulağına en yakın duran makam.",
      "Uşşak": "Türküler, ninni ve ağıt arası sakin ezgiler. İçini dökerken kullanılır.",
      "Kürdi": "Hüzünlü ama yalın parçalar. Az notayla çok şey anlatmak isteyen için uygun.",
      "Hüzzam": "Duygusal doruk noktaları, taksim ve uzun soluklu şarkılar. Dokunaklı anlar için.",
      "Nihavend": "Romantik şarkılar, film müziği, modern düzenlemeler. Batı armonisiyle en kolay birleşen makam."
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
    drums: { doum: "Dum", tek: "Tek", tekhi: "Tek hi", mid: "Mid", mute: "Ka",
      davul_dum: "Davul low", davul_tek: "Davul stick", bendir: "Bendir",
      zil: "Zil", tef: "Tef", snare: "Snare", clap: "Clap" },
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
      "Nihavend": "Romantic and sad. The equivalent of the Western minor scale."
    },
    wheel: "Camelot wheel", wheelNow: "Now", wheelFit: "Mixes with",
    wheelHelp: "Click a code and the tonic and makam follow it. The notes below explain how the system works.",
    learn: "What do these mean?",
    learnCamelot: "Camelot names keys with a number and a letter. The number is the position on the circle, the letter is the colour: A is the dark side (minor), B the bright side (major). 8A is A minor, 8B is C major.\n\nWhy it helps: the two numbers either side of yours, and the other letter on your own number, share almost all their notes with you. If you are on 8A, moving to 7A, 9A or 8B will not jar. DJs use it to blend two tracks, but the same holds inside one piece when you move from section to section.\n\nTwo more moves the wheel does not show: going up a semitone lifts the energy, which is why it turns up before a chorus. Keeping the same root and dropping from major to minor also sounds natural, because the home note never moves.",
    learnKoma: "In Western music the octave is split into 12 equal semitones, the keys of a piano. In Turkish makam music the octave is split into 53 small parts called commas. A whole tone is 9 commas, what we call a semitone is 4 or 5.\n\nThe result: there are pitches that fall between two piano keys, with no key of their own. The notes that make a makam what it is usually live there. The second degree of Hicaz lands on no piano key at all. This is also why a bağlama has far more frets than a guitar.\n\nWhy 53 exactly? Stack pure fifths on top of each other and after 53 steps you land almost exactly on the octave of where you started, by a margin no ear can hear. That makes 53 the ruler that fits the intervals the ear likes best. The West rounded it down to 12 because no keyboard can carry 53 keys to the octave. Turkish music kept the fine pitches and kept the fine ruler, which is the Arel-Ezgi-Uzdilek system.\n\nA bağlama does not have 53 frets. It carries roughly 17 to 24 per octave. The 53 commas are a unit of measurement, not a fret count.\n\nThis app does that arithmetic in the background. You pick the makam and every note is pulled to its own comma pitch. Camelot, built on major and minor, can only approximate it: close to exact in Nihavend and Çargah, rough in Hicaz and Hüzzam.",
    learnKomaT: "What is a comma pitch?", learnCamelotT: "How do you read Camelot?",
    makamUse: {
      "Hicaz": "Arabesque, slow romantic songs, dramatic openings. For longing and parting.",
      "Rast": "Opening pieces, walking and hopeful sections. Easy on the ear over a long stretch.",
      "Çargah": "Children's songs, marches, simple cheerful tunes. The closest to a Western ear.",
      "Uşşak": "Folk songs, somewhere between a lullaby and a lament. For quiet confession.",
      "Kürdi": "Sad but plain pieces. Good when you want to say a lot with few notes.",
      "Hüzzam": "Emotional peaks, taksim improvisations, long songs. For the moments that ache.",
      "Nihavend": "Romantic songs, film music, modern arrangements. The easiest makam to pair with Western harmony."
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
  playing: false, recording: false,
  makam: "Hicaz", tonic: 220.0, smart: true, strings: "metal",
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
const swingShift = i => (i % 2 === 1 ? state.swing * stepDur() * 0.5 : 0);

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const isWhite = m => WHITE_PCS.includes(((m % 12) + 12) % 12);
const midiToName = m => t("noteNames")[((m % 12) + 12) % 12] + Math.floor(m / 12);

function pickSample(freq) {
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

  return { master, drums, bagIn, bagOut, metal, plastic };
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

function stopPlayback() {
  clearInterval(schedTimer); schedTimer = null;
  cancelAnimationFrame(rafId);
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
        for (const n of state.notes) playNote(ctx, nodes, n.f, nextStepTime + n.t, n.vel);
      }
    }
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

  const grid = $("grid");
  grid.innerHTML = "";
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
      cell.className = "cell";
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
  el.style.left = (n.t / loopDur()) * timeW() + "px";
  el.style.width = Math.max(7, (n.len / loopDur()) * timeW() - 1) + "px";
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
    if (n.len === undefined) n.len = stepDur();
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
    let time = (e.clientX - r.left) / timeW() * loopDur();
    if ($("quantize").checked) time = Math.round(time / stepDur()) * stepDur();
    time = Math.max(0, Math.min(time, loopDur() - stepDur() / 2));
    state.notes.push({ t: time, f: keyFreq(k), midi: k.midi, vel: 0.9, len: stepDur() });
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
  const grabX = e.clientX - r.left - (n.t / loopDur()) * timeW();
  el.setPointerCapture(e.pointerId);
  el.classList.add("dragging");

  const move = ev => {
    let time = (ev.clientX - r.left - grabX) / timeW() * loopDur();
    if ($("quantize").checked) time = Math.round(time / stepDur()) * stepDur();
    n.t = Math.max(0, Math.min(time, loopDur() - stepDur() / 2));
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
  let time = (ctx.currentTime - loopStartTime) % loopDur();
  if (time < 0) time += loopDur();
  if ($("quantize").checked) {
    const q = stepDur();
    time = Math.round(time / q) * q;
    if (time >= loopDur()) time = 0;
  }
  state.notes.push({ t: time, f: keyFreq(k), midi: k.midi, vel, len: stepDur() });
  updateNoteCount();
  renderRoll();
}

function updateNoteCount() {
  $("noteCount").textContent = state.notes.length ? state.notes.length + " " + t("notes") : "";
}

function toggleRec(force) {
  state.recording = force !== undefined ? force : !state.recording;
  $("rec").classList.toggle("armed", state.recording);
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
      for (const n of state.notes) playNote(oc, g, n.f, base + n.t, n.vel);
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
      const drums = await renderOffline(repeats, { drums: true });
      const bag = await renderOffline(repeats, { baglama: true });
      status.textContent = t("packing");
      download(makeZip([["darbuka.wav", bufferToWav(drums)], ["baglama.wav", bufferToWav(bag)]]),
               "ck-makam-stems-" + stamp() + ".zip");
    } else {
      const mix = await renderOffline(repeats, { drums: true, baglama: true });
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
  const tick = loopDur() / (steps * 4);
  b.push(notes.length);
  for (const n of notes) {
    const ti = Math.round(n.t / tick);
    b.push(ti & 255, (ti >> 8) & 255, n.midi & 127,
      Math.round(Math.min(1, n.vel || 0.9) * 127),
      Math.max(1, Math.min(255, Math.round((n.len || tick * 4) / tick))));
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
  const tick = loopDur() / (totalSteps() * 4);
  buildKeys();
  state.notes = [];
  for (let i = 0; i < count; i++) {
    const ti = b[p] | (b[p + 1] << 8); p += 2;
    const midi = b[p++], vel = b[p++] / 127, len = b[p++];
    const k = keys.find(x => x.midi === midi) || keys[0];
    state.notes.push({ t: ti * tick, midi, vel, len: len * tick, f: keyFreq(k) });
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

function drawVideoFrame(cx, W, H, pos) {
  const col = {
    bg: cssVar("--bg"), panel: cssVar("--panel2"), ink: cssVar("--ink"),
    muted: cssVar("--muted"), accent: cssVar("--accent"), accent2: cssVar("--accent2"),
    line: cssVar("--line")
  };
  cx.fillStyle = col.bg;
  cx.fillRect(0, 0, W, H);

  cx.fillStyle = col.ink;
  cx.font = "700 54px 'Segoe UI', system-ui, sans-serif";
  cx.textAlign = "center";
  cx.fillText("CK Makam", W / 2, 110);
  cx.fillStyle = col.muted;
  cx.font = "400 30px 'Segoe UI', system-ui, sans-serif";
  cx.fillText(state.makam + "  ·  " + state.usul.replace(/\s*\(.*\)/, "") + "  ·  " + Math.round(state.bpm) + " BPM", W / 2, 160);

  // piano roll strip, one loop wide, scrolling right to left past a fixed playhead
  const rx = 40, rw = W - 80, ry = 230, rh = 620;
  cx.fillStyle = col.panel;
  cx.fillRect(rx, ry, rw, rh);
  const laneCount = keys.length, lh = rh / laneCount;
  for (let i = 0; i < laneCount; i++) {
    const k = keys[laneCount - 1 - i];
    if (!k.white) { cx.fillStyle = "rgba(0,0,0,0.25)"; cx.fillRect(rx, ry + i * lh, rw, lh); }
  }
  const playX = rx + rw * 0.36, pps = rw / loopDur();
  cx.save();
  cx.beginPath(); cx.rect(rx, ry, rw, rh); cx.clip();
  for (const n of state.notes) {
    const li = laneCount - 1 - keys.findIndex(k => k.midi === n.midi);
    if (li < 0) continue;
    for (const off of [-1, 0, 1]) {
      const x = playX + (n.t + off * loopDur() - pos) * pps;
      const w = Math.max(6, (n.len || stepDur()) * pps);
      if (x > rx + rw || x + w < rx) continue;
      const live = x <= playX && x + w >= playX;
      cx.fillStyle = live ? col.accent2 : col.accent;
      cx.fillRect(x, ry + li * lh + 1, w, lh - 2);
    }
  }
  cx.restore();
  cx.fillStyle = col.ink;
  cx.fillRect(playX - 2, ry, 4, rh);

  // drum pads, lighting on the current step
  const steps = totalSteps(), cur = Math.floor(pos / stepDur()) % steps;
  const used = DRUM_ROWS.filter(r => !state.muted.has(r) && state.grid[r].some(v => v));
  const py = 910, padH = 54, gap = 12;
  cx.textAlign = "left";
  used.slice(0, 5).forEach((row, i) => {
    const y = py + i * (padH + gap);
    cx.fillStyle = col.muted;
    cx.font = "400 24px 'Segoe UI', system-ui, sans-serif";
    cx.fillText(I18N[lang].drums[row], rx, y + 36);
    const bx = rx + 210, bw = W - rx - 210 - 40, cw = bw / steps;
    for (let s = 0; s < steps; s++) {
      const v = state.grid[row][s];
      cx.fillStyle = !v ? col.panel : (s === cur ? col.ink : (v === 2 ? col.accent2 : v === 3 ? cssVar("--soft") : col.accent));
      cx.fillRect(bx + s * cw + 1, y + 10, cw - 2, padH - 20);
    }
  });

  cx.fillStyle = col.muted;
  cx.font = "400 28px 'Segoe UI', system-ui, sans-serif";
  cx.textAlign = "center";
  cx.fillText("cemilkocan.github.io/ck-makam", W / 2, H - 60);
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
  const buf = await renderOffline(repeats, { drums: true, baglama: true });

  const canvas = document.createElement("canvas");
  canvas.width = 720; canvas.height = 1280;
  const cx = canvas.getContext("2d");
  drawVideoFrame(cx, canvas.width, canvas.height, 0);

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
      drawVideoFrame(cx, canvas.width, canvas.height, Math.max(0, p) % loopDur());
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
      state.notes = Array.isArray(d.notes) ? d.notes : [];
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
  const w = Math.min(320, window.innerWidth - 24);
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
  $("collapseBtn").textContent = on ? t("expand") : t("collapse");
  $("collapseBtn").setAttribute("aria-expanded", String(!on));
  try { localStorage.setItem("ckm_drums", on ? "hidden" : "shown"); } catch (e) {}
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
  $("rec").textContent = state.recording ? t("recording") : t("record");
  for (const k of ["learnKomaT", "learnCamelotT", "learnKoma", "learnCamelot"])
    $(k).textContent = t(k);
  $("tourSkip").textContent = t("tourSkip");
  $("tourPrev").textContent = t("tourPrev");
  setPlayIcon();
  setCollapsed($("drumBody").hidden);
  fillMakams();
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
  let collapsed = false;
  try { collapsed = localStorage.getItem("ckm_drums") === "hidden"; } catch (e) {}
  $("drumBody").hidden = collapsed;
  applyLang();

  const blur = e => e.target.blur();

  $("play").addEventListener("click", async () => {
    await initAudio();
    state.playing ? stopPlayback() : startPlayback();
  });
  $("bpm").addEventListener("input", e => {
    state.bpm = Math.min(180, Math.max(60, +e.target.value || 100));
    $("bpmRange").value = state.bpm;
  });
  $("bpmRange").addEventListener("input", e => {
    state.bpm = +e.target.value;
    $("bpm").value = state.bpm;
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
