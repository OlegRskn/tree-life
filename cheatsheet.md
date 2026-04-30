# Шпаргалки для проекта

Краткие справочники по тому, что понадобится. Не нужно учить всё сразу — открывай нужный раздел, когда дойдёшь до него в роадмапе.

---

## 1. Каркас проекта

### `index.html`

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Tree Life</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <canvas id="world" width="800" height="400"></canvas>
  <script src="main.js"></script>
</body>
</html>
```

Скрипт подключается **в конце body** — иначе он попытается найти канвас раньше, чем тот появится в DOM.

### `style.css`

```css
body {
  margin: 0;
  background: #222;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}
canvas {
  background: #87CEEB;
  border: 1px solid #000;
}
```

### Запуск

Просто открой `index.html` двойным кликом. Никакого сервера не нужно.

---

## 2. Канвас — основные команды

### Получить контекст

```js
const canvas = document.getElementById('world')
const ctx = canvas.getContext('2d')
```

`ctx` — это объект, через который ты рисуешь. Все команды идут через него.

### Залить прямоугольник

```js
ctx.fillStyle = 'green'         // цвет заливки
ctx.fillRect(x, y, width, height)
```

### Контур прямоугольника

```js
ctx.strokeStyle = 'black'
ctx.lineWidth = 1
ctx.strokeRect(x, y, width, height)
```

### Очистить весь канвас

```js
ctx.clearRect(0, 0, canvas.width, canvas.height)
```

### Текст

```js
ctx.fillStyle = 'white'
ctx.font = '14px monospace'
ctx.fillText('Tick: ' + tickCount, 10, 20)
```

### Цвета

Можно использовать имена (`'red'`, `'green'`), hex (`'#3a8'`) или rgba (`'rgba(0, 255, 0, 0.5)'`). Последний вариант полезен для прозрачности.

### Координаты — внимание

```
(0,0)─────────► X
  │
  │
  ▼
  Y
```

Точка `(0, 0)` — **левый верхний** угол. Y растёт **вниз**. Это значит: клетка с `y = 0` находится на самом верху мира, а с `y = worldHeight - 1` — на дне. Когда говоришь "растёт вверх", это значит `y` **уменьшается**.

---

## 3. Игровой цикл

Шаблон, на котором стоит вся симуляция:

```js
let tickCount = 0

function tick() {
  tickCount++

  update()  // обновить состояние мира
  draw()    // перерисовать

  requestAnimationFrame(tick)
}

requestAnimationFrame(tick)  // запустить цикл
```

`requestAnimationFrame` сам синхронизируется с частотой обновления экрана (обычно 60 Гц). Не используй `setInterval` для рендера — он не такой ровный.

### Замедлить симуляцию

Не каждый кадр должен двигать симуляцию. Часто нужно: рендер 60 раз в секунду, а логика — 10 раз в секунду.

```js
function tick() {
  tickCount++

  if (tickCount % 6 === 0) {  // каждые 6 кадров = 10 раз в секунду
    updateSimulation()
  }

  draw()
  requestAnimationFrame(tick)
}
```

### Ускорить симуляцию

Наоборот, если хочешь смотреть на эволюцию быстро — делай несколько шагов за кадр:

```js
function tick() {
  for (let i = 0; i < 50; i++) {
    updateSimulation()
  }
  draw()
  requestAnimationFrame(tick)
}
```

---

## 4. Двумерные массивы

### Создание массива нужного размера, заполненного значением

```js
const width = 20
const height = 10

// плохо: все строки ссылаются на ОДИН массив
const wrong = new Array(width).fill(new Array(height).fill('air'))

// правильно: каждая строка — независимый массив
const world = Array.from({ length: width }, () =>
  Array.from({ length: height }, () => 'air')
)
```

Важно: первый вариант — частая ошибка. Если потом написать `wrong[0][5] = 'soil'`, значение появится во **всех** столбцах. Из-за такой ошибки можно потерять часы в отладке.

### Обход массива

```js
for (let x = 0; x < width; x++) {
  for (let y = 0; y < height; y++) {
    const cell = world[x][y]
    // ...
  }
}
```

### Безопасный доступ

При обращении к `world[x][y]` всегда проверяй, что `x` и `y` в пределах:

```js
function getCell(x, y) {
  if (x < 0 || x >= width || y < 0 || y >= height) return null
  return world[x][y]
}
```

Без этой проверки получишь `Cannot read properties of undefined`.

---

## 5. Случайные числа

### Случайное целое от `min` до `max` включительно

```js
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
```

### Проверка вероятности

```js
if (Math.random() < 0.05) {  // 5% шанс
  mutate()
}
```

### Случайный элемент массива

```js
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}
```

---

## 6. Копирование ДНК (глубокое копирование)

Если делаешь `const childDna = parentDna`, оба растения будут шарить **один и тот же массив**. Изменишь у потомка — изменится и у родителя. Это критическая ошибка.

Для двумерного массива чисел используй:

```js
function cloneDna(dna) {
  return dna.map(row => row.slice())
}
```

Или универсальный способ через JSON (медленнее, но работает для любой структуры):

```js
const childDna = JSON.parse(JSON.stringify(parentDna))
```

### Мутация

```js
function mutate(dna, rate = 0.05) {
  if (Math.random() > rate) return dna  // мутации не случилось

  const newDna = cloneDna(dna)
  const x = randomInt(0, newDna.length - 1)
  const y = randomInt(0, newDna[0].length - 1)
  newDna[x][y] = randomInt(0, 4)
  return newDna
}
```

---

## 7. Работа с массивами сущностей

Когда у тебя `plants[]` и `seeds[]` — типичные операции:

### Добавить

```js
plants.push(newPlant)
```

### Удалить умерших (фильтрация)

```js
plants = plants.filter(plant => plant.energy > 0)
```

`filter` возвращает **новый** массив, оставляя только те элементы, для которых функция вернула `true`.

### Обход с возможным удалением "на лету"

Если внутри цикла нужно и обновлять, и удалять — сделай в два прохода:

```js
// сначала обновить всех
for (const plant of plants) updatePlant(plant)

// потом отфильтровать мёртвых
plants = plants.filter(p => p.alive)
```

Удаление прямо во время `for`-цикла приводит к багам пропуска элементов.

---

## 8. Структура `main.js` (общая форма)

К концу проекта твой файл будет выглядеть примерно так:

```js
// === КОНСТАНТЫ ===
const CELL_SIZE = 8
const WIDTH = 100
const HEIGHT = 50
const GROUND_LEVEL = 40

// === СОСТОЯНИЕ ===
const canvas = document.getElementById('world')
const ctx = canvas.getContext('2d')
let tickCount = 0
let world = []
let plants = []
let seeds = []

// === ИНИЦИАЛИЗАЦИЯ ===
function init() {
  // создать world, посадить первое семя
}

// === ОБНОВЛЕНИЕ ===
function update() {
  computeLight()
  for (const plant of plants) updatePlant(plant)
  for (const seed of seeds) updateSeed(seed)
  // удалить умерших
}

// === РИСОВАНИЕ ===
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawWorld()
  drawPlants()
  drawSeeds()
  drawHud()
}

// === ЦИКЛ ===
function tick() {
  tickCount++
  if (tickCount % 3 === 0) update()
  draw()
  requestAnimationFrame(tick)
}

init()
tick()
```

Эту структуру держи в голове с самого начала — даже если на этапе 1 у тебя только `init` и `draw`. Так код растёт, а не превращается в кашу.

---

## 9. Отладка

### Console.log, но с умом

```js
console.log('plant', plant.id, 'energy:', plant.energy)
```

Добавь `id` к каждому растению при создании — тогда в логах сразу видно, о каком из них речь.

### Пауза по клавише

В начале файла:

```js
let paused = false
document.addEventListener('keydown', e => {
  if (e.key === ' ') paused = !paused
})

function tick() {
  if (!paused) {
    tickCount++
    update()
  }
  draw()
  requestAnimationFrame(tick)
}
```

Пробел останавливает симуляцию — удобно, чтобы рассмотреть момент, когда что-то пошло не так.

### Клик по канвасу

```js
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect()
  const x = Math.floor((e.clientX - rect.left) / CELL_SIZE)
  const y = Math.floor((e.clientY - rect.top) / CELL_SIZE)
  console.log('clicked cell', x, y, world[x][y])
})
```

Полезно для инспекции отдельных клеток.

---

## 10. Производительность

Если симуляция начала тормозить:

- **Не создавай новые массивы каждый кадр.** Заведи `lightMap` один раз и переиспользуй.
- **Меньше `console.log`** — они дорогие в горячем цикле.
- **Не перерисовывай весь мир каждый кадр**, если он не меняется — но это уже продвинутая оптимизация, можешь не делать до этапа 8.
- **Размер мира.** 100×50 = 5000 клеток — это нормально. 1000×500 = полмиллиона — уже тяжело.

---

## 11. Где смотреть, если что-то непонятно

Для канваса лучшее место — MDN: <https://developer.mozilla.org/ru/docs/Web/API/Canvas_API/Tutorial>. Это официальная документация, и там есть примеры на каждую функцию.

Для базового JS — то же самое, MDN. Гугли вида `mdn array filter`, `mdn requestAnimationFrame`.

DevTools браузера (F12) — твой главный инструмент. Console показывает ошибки и `console.log`. Sources позволяет ставить точки останова. Не бойся в нём ковыряться.
