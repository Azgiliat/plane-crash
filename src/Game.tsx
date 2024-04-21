import {Plane} from "./Plane.ts";
import {SyntheticEvent, useCallback, useEffect, useRef} from "react";
import background from './assets/back.jpg'
import cloud from './assets/cloud.png'
import plane from './assets/plane.png'
import boom from './assets/boom.png'

type Props = {
  isGameInProgress: boolean
  setGameInProgress: (v: boolean) => void
  updateMultiplier: (val: number) => void
}

export function Game({isGameInProgress, setGameInProgress, updateMultiplier}: Props) {
  const game = useRef(new Plane())
  const canvas = useRef(null)
  const obs = useRef(new ResizeObserver(([canvas]) => {
    game.current.updateCanvasSize(canvas.contentRect.width, canvas.contentRect.height)
  }))
  
  const setGameFinished = useCallback(() => setGameInProgress(false), [setGameInProgress])
  const setMultiplier = useCallback((m: number) => updateMultiplier(m), [updateMultiplier])

  function onImageLoad(evt: SyntheticEvent<HTMLImageElement, Event>) {
    game.current.loadPlaneImage(evt.currentTarget)
  }

  function onBackgroundLoad(evt: SyntheticEvent<HTMLImageElement, Event>) {
    game.current.loadBackground(evt.currentTarget)
  }

  function onCloudLoad(evt: SyntheticEvent<HTMLImageElement, Event>) {
    game.current.loadCloudImage(evt.currentTarget)
  }
  
  function onBoomLoad(evt: SyntheticEvent<HTMLImageElement, Event>) {
    game.current.loadBoomImage(evt.currentTarget)
  }

  useEffect(() => {
    if (canvas.current) {
      obs.current.observe(canvas.current)

      game.current.attach(canvas.current)
      game.current.init()
      game.current.subscribeToEvent('multiplierUpdate', setMultiplier)
      game.current.subscribeToEvent('finish', setGameFinished)
      
      return () => {
        obs.current.disconnect()
        game.current.detach()
      }
    }
  }, [])


  useEffect(() => {
    if (isGameInProgress && !game.current.isInProgress) {
      console.log('starting game')
      game.current.reset()
      game.current.startTakeOff()
    }
  }, [isGameInProgress]);

  return (
    <div className="h-[calc(100vh-theme('spacing.10'))]">
      <img className="hidden" onLoad={onBoomLoad} src={boom}/>
      <img className="hidden" onLoad={onCloudLoad} src={cloud}/>
      <img className="hidden" onLoad={onBackgroundLoad} src={background}/>
      <img className="hidden" onLoad={onImageLoad} src={plane}/>
      <div className="w-full h-full">
        <canvas className="w-full h-full" ref={canvas}/>
      </div>
    </div>
  )
}
