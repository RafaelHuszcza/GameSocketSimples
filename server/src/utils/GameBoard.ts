const boardData = [
  ['INICIO', 'VOLTA_1', 'AVANCA_5', '', 'VOLTA_2'],
  ['', 'SORTEREVES_5', 'VOLTA_10', '', 'AVANCA_1'],
  ['', '', 'SORTEREVES_5', 'AVANCA_1', ''],
  ['VOLTA_1', 'AVANCA_2', '', 'SORTEREVES_5', 'SORTEREVES_5'],
  ['', '', 'AVANCA_1', 'VOLTA_10', 'FIM'],
]

function getSum(actionValue: string, x: number, y: number) {
  let outX = x + parseInt(actionValue)
  let outY = y
  while (outX > 4) {
    outY = outY + 1
    outX = outX - 5
  }
  return { outX, outY }
}

function getSub(actionValue: string, x: number, y: number) {
  let outX = x - parseInt(actionValue)
  let outY = y
  while (outX < 0) {
    outY = outY - 1
    outX = outX + 5
  }
  return { outX, outY }
}

function rollDice(x: number, y: number, diceValue: number) {
  let newX = x + diceValue
  let newY = y
  while (newX > 4) {
    newY = newY + 1
    newX = newX - 5
  }
  return { newX, newY }
}

export function getNewXY(
  x: number,
  y: number,
  diceValue: number,
): { outX: number; outY: number } {
  const { newX, newY } = rollDice(x, y, diceValue)
  const action = boardData[x][y]
  const splittedAction = action.split('_')
  const actionType = splittedAction[0]
  const actionValue = splittedAction[1]
  console.log(actionType, actionValue)
  console.log(
    `Posição atual: ${x} ${y} -> Rolagem do dado: ${diceValue}: ${newX} ${newY} -> Ação: ${actionType} ${actionValue}`,
  )
  let resultXY
  switch (actionType) {
    case 'AVANCA':
      resultXY = getSum(actionValue, newX, newY)
      break
    case 'VOLTA':
      resultXY = getSub(actionValue, newX, newY)
      break
    case 'SORTE':
      if (Math.floor(Math.random() * 2) === 1)
        resultXY = getSum(actionValue, newX, newY)
      else resultXY = getSub(actionValue, newX, newY)
      break
    default:
      resultXY = { outX: newX, outY: newY }
      break
  }
  console.log(`Resultado: ${resultXY.outX} ${resultXY.outY}`)
  return resultXY
}
