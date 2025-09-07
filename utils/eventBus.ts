type EventCallback = (data: any) => void;

class EventBus {
  private events: Map<string, EventCallback[]> = new Map();

  subscribe(event: string, callback: EventCallback): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }

    this.events.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.events.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  // Alias for subscribe to match expected interface
  on(event: string, callback: EventCallback): () => void {
    return this.subscribe(event, callback);
  }

  // Method to remove specific callback
  off(event: string, callback: EventCallback): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event: string, data?: any): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  unsubscribe(event: string): void {
    this.events.delete(event);
  }
}

export const eventBus = new EventBus();

// Event types
export const EVENTS = {
  NOTE_CREATED: 'note_created',
  NOTE_UPDATED: 'note_updated',
  TASK_CREATED: 'task_created',
  TASK_UPDATED: 'task_updated',
  REMINDER_CREATED: 'reminder_created',
  REMINDER_UPDATED: 'reminder_updated',
  TEMPLATE_CREATED: 'template_created',
  TEMPLATE_UPDATED: 'template_updated',
  NOTE_DELETED: 'note_deleted',
  NOTE_RESTORED: 'note_restored',
  NOTE_PERMANENTLY_DELETED: 'note_permanently_deleted',
  TASK_DELETED: 'task_deleted',
  REMINDER_DELETED: 'reminder_deleted',
  TEMPLATE_DELETED: 'template_deleted',
} as const;