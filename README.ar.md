<div dir="rtl" lang="ar" align="center">

# 🇸🇦 OpenCode RTL Fix

**إضافة ثنائية الاتجاه (RTL/LTR) لأوبن‌كود** — إصلاح عرض النصوص المختلطة بين العربية/الفارسية/العبرية والإنجليزية في طرفية أوبن‌كود وسطح المكتب والواجهة الشبكية

[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-green?style=for-the-badge)]()
[![CI](https://img.shields.io/github/actions/workflow/status/programmer-1998/RTL_OpenCode/ci.yml?style=for-the-badge)](https://github.com/programmer-1998/RTL_OpenCode/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/opencode-rtl-fix?style=for-the-badge&label=npm)](https://www.npmjs.com/package/opencode-rtl-fix)
[![GitHub](https://img.shields.io/badge/GitHub-RTL__OpenCode-181717?style=for-the-badge&logo=github)](https://github.com/programmer-1998/RTL_OpenCode)

**اللغات:** [🇮🇷 فارسی](README.md) · [🇬🇧 English](README.en.md) · [🇸🇦 العربية](README.ar.md)

<img src="example.png" alt="إصلاح RTL لأوبن‌كود أثناء العمل — النص الفارسي والإنجليزي يُعرض دون خلط" width="800">

</div>

<div dir="rtl" lang="ar">

## 📌 المشكلة

عندما تظهر كلمة إنجليزية أو معرّف داخل جملة عربية/فارسية — مثل `SINA` أو اسم ملف أو مسار أو اسم حزمة — تُخلط واجهة أوبن‌كود ترتيب الكلمات لأنها لا تطبّق خوارزمية ثنائية الاتجاه لليونيكود (**UAX #9**):

```
ما كتبته (الترتيب المنطقي):      سلام من SINA هستم
عرض معطّل:                       هستم SINA سلام من
العرض الصحيح (بصريًا):           هستم SINA من سلام    ← يُقرأ من اليمين إلى اليسار
```

تظهر هذه المشكلة في **الطرفية/TUI** و**تطبيق سطح المكتب** و**الواجهة الشبكية**، أثناء الكتابة في حقل الإدخال وعند عرض الرسائل وردود النموذج.

## 🧠 الحل — طبقتان

يحل هذا المشروع المشكلة عبر **طبقتين متكاملتين**:

| الطبقة | الأداة | ماذا تُصلح |
| --- | --- | --- |
| **1) طبقة النص (خادم أوبن‌كود)** | إضافة `server` | رسائل المستخدم المُرسلة وسجل المحادثة وردود النموذج ومخرجات الأدوات — عبر **عزل ثنائي الاتجاه** (`RLI` / `LRI` / `PDI`) وفق UAX #9 |
| **2) طبقة الواجهة (سطح المكتب)** | سكربت `patch/desktop-rtl.sh` | **حقل الكتابة المباشر** الذي لا تصل إليه أي خطافات إضافة — عبر حقن `dir="auto"` + `unicode-bidi: plaintext` داخل `app.asar` |

<details>
<summary>🔍 كيف يعمل؟</summary>

- **الإضافة** ترتبط بخطافات خادم أوبن‌كود (`chat.message`، `experimental.text.complete`، `tool.execute.after`، …). لكل فقرة تُحدد الاتجاه بقاعدة «أول حرف قوي»؛ الفقرات العربية/الفارسية تُغلَّف بـ `RLI…PDI`، والكلمات/الأكواد الإنجليزية داخلها (مثل `SINA` أو `/path/to/file`) تُعزل بـ `LRI…PDI` حتى لا ينقلب ترتيبها. هذه المحارف التحكمية غير مرئية ولا تؤثر على النموذج.
- **رقع سطح المكتب** تُضيف `<style>` و `<script>` إلى `out/renderer/index.html` داخل `app.asar` بحيث يكتشف Chromium اتجاه كل فقرة تلقائيًا — نفس ما تفعله `dir="auto"` في المتصفحات الحديثة.

</details>

## ✨ المميزات

- ✅ عرض صحيح للفقرات المختلطة العربية/الفارسية/العبرية/الأردية + الإنجليزية
- ✅ عزل الكلمات والمعرّفات الإنجليزية داخل النص العربي (`SINA`، `API`، المسارات)
- ✅ حماية كاملة للـ**كود** — كتل الخلفيات الثلاثية، الأكواد المزاحة و`inline code` تبقى كما هي
- ✅ تصحيح الرسائل السابقة (سجل المحادثة) عند تحميلها
- ✅ اكتشاف تلقائي للاتجاه (أول حرف قوي) + إمكانية فرض `rtl`/`ltr`
- ✅ إرشاد اختياري للنظام حتى يجيب النموذج بلغتك ويُبقي الكود/المسارات LTR
- ✅ متغيرات بيئة اختيارية `OPENCODE_RTL*` للأدوات
- ✅ أمران لحالة TUI: `RTL: Show Status` و `RTL: Analyze Sample`
- ✅ رقعة سطح المكتب مع نسخة احتياطية تلقائية وتحقّق من تخطيط `app.asar.unpacked` وإمكانية التراجع (`--unpatch`)

## ⚠️ قيد مهم (بصراحة)

**حقل كتابة البرومبت أثناء الكتابة الفعلية قبل الإرسال يُرسم بواجهة أوبن‌كود نفسها ولا يصل إليه أي خطاف إضافة.** لذلك:

- **تطبيق سطح المكتب** → يُصلح هذا الجزء `patch/desktop-rtl.sh` (الطبقة ٢).
- **الطرفية/TUI** → يُرسم خليةً بخلية عبر `@opentui/core`، والحل النهائي له يرجع إلى أوبن‌كود نفسه؛ لكن فور إرسال الرسالة، يُصلح برومبتك ورد النموذج عبر الطبقة ١ في كل مكان.

---

## 🚀 التثبيت والتفعيل في أوبن‌كود

أوبن‌كود يحمّل الإضافات **عند بدء التشغيل فقط**. بعد أي تغيير في الإعداد، أغلق أوبن‌كود وأعد فتحه.

### الخيار ١ — من npm (بعد النشر)

```jsonc
// ~/.config/opencode/opencode.jsonc  (عام)
// أو opencode.jsonc في جذر مشروعك (محلي)
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    [
      "opencode-rtl-fix",
      { "language": "auto" }
    ]
  ]
}
```

### الخيار ٢ — من المصدر / مسار محلي

```sh
git clone git@github.com:programmer-1998/RTL_OpenCode.git
cd RTL_OpenCode
npm ci && npm run build
```

ثم أشر إلى المجلد (أو إلى `dist/server.js`) في الإعداد:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    [
      "/home/<user>/RTL_OpenCode",
      { "language": "auto", "isolateToolOutput": "off" }
    ]
  ]
}
```

> 💡 بدل المسار المطلق يمكنك استخدام `./RTL_OpenCode` (نسبةً إلى مجلد الإعداد) أو `file:///...` — كل النماذج الثلاثة صالحة.

### الخيار ٣ — اكتشاف تلقائي داخل المشروع

ضع الإضافة داخل أحد هذين المجلدين المحليين وسيجدها أوبن‌كود دون إعداد:

```
.opencode/plugin/rtl/package.json
.opencode/plugin/rtl/dist/…
```

---

## ⚙️ خيارات الإضافة

| الخيار | الافتراضي | الوصف |
| --- | --- | --- |
| `enabled` | `true` | تشغيل/إيقاف الكل |
| `language` | `"auto"` | `auto` أو `none` أو `fa` / `ar` / `he` / `ur` (فرض لغة) |
| `systemGuidance` | `true` | إضافة إرشاد RTL إلى برومبت النظام (أو نص مخصص) |
| `isolateUserMessages` | `"auto"` | `off` / `auto` / `always` — عزل رسائل المستخدم |
| `isolateAssistantText` | `"auto"` | عزل ردود النموذج |
| `isolateToolOutput` | `"off"` | عزل مخرجات الأدوات (أبقِه `off` إن كانت النسخ/اللصق الدقيق مهمًا) |
| `minRtlRatio` | `0.2` | أقل نسبة أحرف RTL للاكتشاف التلقائي |
| `minRtlCharacters` | `2` | أقل عدد أحرف RTL |
| `digitMode` | `"preserve"` | تحويل الأرقام: `preserve` / `latin` / `arabic-indic` / `eastern-arabic` |
| `forceDirection` | `"auto"` | فرض اتجاه العزل: `auto` / `rtl` / `ltr` |
| `alignRtlParagraphs` | `false` | محاذاة يمين بصرية في الطرفية عبر padding **(يغيّر النص الخام أيضًا؛ TUI فقط)** |
| `rtlWrapColumn` | `96` | عمود الالتفاف المستخدم في المحاذاة |
| `rtlAlignColumn` | `96` | عمود المحاذاة اليمنى |
| `directionEnv` | `true` | تصدير `OPENCODE_RTL*` في بيئة الأدوات |
| `debug` | `false` | تسجيل عبر `client.app.log()` |

> **ملاحظة الاتجاه:** الاتجاه بحسب «أول حرف قوي»؛ جملة تبدأ بالعربية تصبح RTL، وجملة تبدأ بالإنجليزية/كود تصبح LTR. لفرض RTL دائمًا: `"forceDirection": "rtl"`.

---

## 🖥️ رقعة تطبيق سطح المكتب (لحقل الكتابة)

يُرسم تطبيق Electron النص دون أي اتجاه تلقائي. يضيف هذا السكربت `<style>` + `<script>` إلى `out/renderer/index.html` داخل `app.asar` ليعمل حقل الكتابة والرسائل تمامًا كما في المتصفحات الحديثة.

### التثبيت

```sh
# المتطلبات: node + npx
sudo bash patch/desktop-rtl.sh
```

ماذا يفعل:
1. ينشئ نسخة احتياطية من `app.asar` في مكانها (`app.asar.bak-rtl`)؛
2. يستخرج الأرشيف ويُرقع `index.html` ويعيد التعبئة؛
3. **يتحقق من تخطيط `app.asar.unpacked` (الوحدات الأصلية مثل `node-pty`) واحدًا تلو الآخر مقابل النسخة السابقة** حتى لا ينكسر شيء.

ثم **أغلق وأعد فتح تطبيق أوبن‌كود لسطح المكتب**.

### التراجع

```sh
sudo bash patch/desktop-rtl.sh --unpatch
```

### ⚠️ بعد كل تحديث لسطح المكتب

التطبيق يتحدّث تلقائيًا والتحديث يستبدل الملف المُرقَّع. ما عليك سوى إعادة تشغيل السكربت بعد كل تحديث.

> المسار الافتراضي `/opt/OpenCode/resources/app.asar`. إذا كان مثبتًا في مكان آخر: `sudo DESKTOP_ASAR=/path/to/app.asar bash patch/desktop-rtl.sh`

---

## 🧪 الاختبار في أوبن‌كود (خطوة بخطوة)

1. أغلق أوبن‌كود وأعد فتحه (ليتم تحميل الإضافة).
2. في **سطح المكتب**، اكتب هذا النص في حقل الكتابة — يجب أن يُقرأ طبيعيًا من اليمين إلى اليسار مع `SINA` في مكانه الصحيح:

   ```
   سلام من SINA هستم
   ```

3. أرسل برومبت مختلطًا يحتوي مسارًا/كودًا، مثل:

   ```
   محتوای فایل src/config.ts را بخوان و لیست بده
   ```

   وتحقّق من عدم انقلاب ترتيب `src/config.ts` مع الجملة الفارسية.
4. في **الطرفية**، إن كان لديك الأمر، تحقق من حالة الإضافة:

   ```
   /rtl.status
   ```

5. شغّل الاختبارات الآلية:

   ```sh
   cd RTL_OpenCode && npm test
   ```

---

## 🛠️ التطوير

```sh
npm ci
npm run build      # tsc → dist/
npm run typecheck
npm test           # البناء + 14 اختبارًا
```

## 📂 البنية

```
RTL_OpenCode/
├── src/
│   ├── core.ts      ← محرك Bidi: اكتشاف الاتجاه، العزل، ماركداون/كود، المحاذاة
│   ├── server.ts    ← خطافات الخادم (Plugin)
│   ├── tui.ts       ← أوامر TUI (RTL: Show Status / Analyze Sample)
│   └── index.ts     ← المخرجات
├── test/core.test.js   ← الاختبارات
├── patch/desktop-rtl.sh ← سكربت رقعة سطح المكتب
├── examples/opencode.json ← نموذج إعداد كامل
└── dist/             ← ناتج البناء (مُرفَع)
```

## 🤖 CI والنشر (GitHub Actions)

- **`.github/workflows/ci.yml`** — عند push/PR: تثبيت، typecheck، بناء، اختبار على Node 20/22/24 + التحقق من تطابق `dist` مع المصدر.
- **`.github/workflows/release.yml`** — عند رفع وسم `v*`:
  - يُنشئ **Release** على GitHub مع حزمة (zip) + `npm pack` (.tgz)؛
  - إذا كان سر `NPM_TOKEN` مضبوطًا يُنشر تلقائيًا على **npm** (`opencode-rtl-fix`).

  إنشاء نسخة:

  ```sh
  git tag v0.1.0 && git push origin v0.1.0
  ```

---

## 🙏 الشكر والإسناد

- **أوبن‌كود** — [github.com/anomalyco/opencode](https://github.com/anomalyco/opencode) · [opencode.ai](https://opencode.ai)
- إضافة **opencode-rtl** على npm (المؤلِّف: `razavioo`) التي كانت مصدر إلهام هذا التنفيذ
- عناصر ذات صلة في مستودع أوبن‌كود:
  - [issue #35319](https://github.com/anomalyco/opencode/issues/35319) — نص مختلط معطّل في سطح المكتب
  - [issue #32984](https://github.com/anomalyco/opencode/issues/32984) — عرض RTL في الواجهات
  - [issue #40286](https://github.com/anomalyco/opencode/issues/40286) — RTL/Bidi في TUI
  - [PR #25455](https://github.com/anomalyco/opencode/pull/25455) — `dir="auto"` للويب

## 📄 الترخيص

[MIT](LICENSE) © sina khanzadeh

</div>