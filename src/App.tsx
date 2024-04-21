import {Game} from "./Game.tsx";
import {GameControls} from "./GameControls.tsx";
import {useState} from "react";


function App() {
  const [multiplier, setMultiplier] = useState(1)
  const [isGameStarted, setIsGameStarted] = useState(false)

  return (
    <>
      <Game setGameInProgress={setIsGameStarted} isGameInProgress={isGameStarted} updateMultiplier={setMultiplier} />
      <GameControls multiplier={multiplier} changeGameStatus={setIsGameStarted} gameStatus={isGameStarted}/>
    </>
  )
}

export default App
