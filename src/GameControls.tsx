import {useEffect, useState} from "react";

type Props = {
  gameStatus: boolean
  changeGameStatus: (status: boolean) => void
  multiplier: number
}

const BET = 1

export function GameControls(props: Props) {
  const [balance, setBalance] = useState(100)
  const [hasBet, setHasBet] = useState(false)
  const buttonText = () => hasBet ? `Withdraw ${BET}$ * ${props.multiplier}` : `Bet ${BET}$`
  const onButtonClick = () => {
    if (!hasBet && !props.gameStatus) {
      if (balance - BET >= 0) {
        props.changeGameStatus(true)
        setBalance(balance => balance - BET)
        setHasBet(true) 
      }

      return
    }

    // succesfull withdraw
    if (props.gameStatus && hasBet) {
      setBalance(balance => balance + BET * props.multiplier)
      setHasBet(false)
    }
  }

  useEffect(() => {
    if (hasBet && !props.gameStatus) {
      setHasBet(false)
    }
  }, [props.gameStatus]);

  return (
    <div className="h-10 flex">
      <p className="p-2 mr-4">
        Your balance: {balance} $
      </p>
      <button className="border border-black p-2" onClick={onButtonClick}>
        {buttonText()}
      </button>
    </div>
  )
}
