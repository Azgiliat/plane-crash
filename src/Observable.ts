type SubscriptionFunction<T = any> = (val: T) => void

export class Observable {
  private events = new Map<string, Set<SubscriptionFunction>>
  
  subscribeToEvent<T>(event: string, cb: SubscriptionFunction<T>) {
    let subscription = this.events.get(event)
    
    if (!subscription) {
      subscription = new Set([])
      this.events.set(event, subscription)
    }
    
    if (!subscription.has(cb)) {
      subscription.add(cb)
    }
  }
  
  unsubscribe(event: string, cb: SubscriptionFunction) {
    const subscriptions = this.events.get(event)
    
    if (subscriptions && subscriptions.has(cb)) {
      subscriptions.delete(cb)
    }
  }
  
  protected fireEvent(event: string, val?: unknown) {
    const subscriptions = this.events.get(event)
    console.log('firing event', event)
    if (subscriptions) {
      subscriptions.forEach(cb => cb(val))
    }
  }
  
  protected clearSubscriptions () {
    this.events.clear()
  }
}
