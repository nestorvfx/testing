// Priority queue for managing analysis tasks
// Higher priority tasks will be processed first

export class PriorityQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.currentTask = null;
    this.onProcessingComplete = null;
  }

  // Add a new task to the queue with a given priority
  // Higher number = higher priority
  addTask(task, priority = 1) {
    this.queue.push({ task, priority, timestamp: Date.now() });
    this.sortQueue();
    return { 
      id: task.id || Date.now(),
      cancel: () => this.cancelTask(task.id || task.uri) 
    };
  }

  // Sort the queue by priority (descending) and then by timestamp (ascending)
  sortQueue() {
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.timestamp - b.timestamp; // Older tasks first within same priority
    });
  }

  // Get the next task from the queue
  getNextTask() {
    if (this.queue.length === 0) return null;
    return this.queue.shift();
  }

  // Cancel a specific task by id or uri
  cancelTask(identifier) {
    // If it's the current task
    if (this.currentTask && 
        (this.currentTask.task.id === identifier || 
         this.currentTask.task.uri === identifier)) {
      // Mark current task as canceled, it will be checked during processing
      this.currentTask.canceled = true;
      return true;
    }
    
    // If it's in the queue
    const index = this.queue.findIndex(item => 
      item.task.id === identifier || item.task.uri === identifier);
    
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    
    return false;
  }

  // Cancel all tasks with priority lower than specified
  cancelLowerPriorityTasks(minPriority) {
    this.queue = this.queue.filter(item => item.priority >= minPriority);
  }

  // Start processing the queue
  async startProcessing(processorFn, onComplete) {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.onProcessingComplete = onComplete;
    
    while (this.queue.length > 0) {
      this.currentTask = this.getNextTask();
      
      if (!this.currentTask.canceled) {
        try {
          await processorFn(this.currentTask.task);
        } catch (error) {
          console.error("Error processing task:", error);
        }
      }
    }
    
    this.isProcessing = false;
    this.currentTask = null;
    
    if (this.onProcessingComplete) {
      this.onProcessingComplete();
    }
  }

  // Check if the queue is currently processing
  isCurrentlyProcessing() {
    return this.isProcessing;
  }

  // Get the number of tasks in the queue
  getQueueLength() {
    return this.queue.length;
  }

  // Clear all tasks from the queue
  clear() {
    this.queue = [];
    if (this.currentTask) {
      this.currentTask.canceled = true;
    }
  }
}

// Create a singleton instance for the application
export const analysisQueue = new PriorityQueue();

// Define priority levels as constants
export const PRIORITY = {
  LOW: 1,       // Background/automatic analysis
  NORMAL: 2,    // Standard user-initiated analysis
  HIGH: 3,      // Voice-prompted analyses
  URGENT: 4     // Critical/time-sensitive analyses
};
