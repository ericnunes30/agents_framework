import { Crew } from './Crew.js';
import { ProcessContext } from './Crew.js';

/**
 * Base process orchestrator for crew execution
 */
export abstract class BaseProcessOrchestrator {
  /**
   * Execute the process
   */
  abstract execute(crew: Crew, input: string, context: ProcessContext): Promise<Record<string, any>>;

  /**
   * Validate process configuration
   */
  abstract validate(crew: Crew): boolean;
}

/**
 * Sequential process orchestrator
 */
export class SequentialOrchestrator extends BaseProcessOrchestrator {
  async execute(crew: Crew, input: string, context: ProcessContext): Promise<Record<string, any>> {
    return crew['executeSequential'](context);
  }

  validate(crew: Crew): boolean {
    const tasks = crew.getDefinition().tasks;
    return tasks.every((task, index) => {
      if (index === 0) return true;
      return task.context?.length > 0;
    });
  }
}

/**
 * Hierarchical process orchestrator
 */
export class HierarchicalOrchestrator extends BaseProcessOrchestrator {
  async execute(crew: Crew, input: string, context: ProcessContext): Promise<Record<string, any>> {
    return crew['executeHierarchical'](context);
  }

  validate(crew: Crew): boolean {
    const tasks = crew.getDefinition().tasks;
    return tasks.length >= 2;
  }
}

/**
 * Collaborative process orchestrator
 */
export class CollaborativeOrchestrator extends BaseProcessOrchestrator {
  async execute(crew: Crew, input: string, context: ProcessContext): Promise<Record<string, any>> {
    return crew['executeCollaborative'](context);
  }

  validate(crew: Crew): boolean {
    const tasks = crew.getDefinition().tasks;
    return tasks.length > 0;
  }
}

/**
 * Process orchestrator factory
 */
export class ProcessOrchestratorFactory {
  static create(processType: string): BaseProcessOrchestrator {
    switch (processType) {
      case 'sequential':
        return new SequentialOrchestrator();
      case 'hierarchical':
        return new HierarchicalOrchestrator();
      case 'collaborative':
        return new CollaborativeOrchestrator();
      default:
        throw new Error(`Unknown process type: ${processType}`);
    }
  }
}