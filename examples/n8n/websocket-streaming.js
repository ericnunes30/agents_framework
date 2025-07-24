// n8n Custom Node for WebSocket Streaming with Agent Framework
// This code can be used in a "Code" node in n8n for real-time execution monitoring

const WebSocket = require('ws');

// Input data from previous node
const inputData = $input.first().json;
const { configPath, task, type = 'agent' } = inputData;

// Configuration
const AGENT_FRAMEWORK_WS = 'ws://localhost:3000/ws';
const AGENT_FRAMEWORK_HTTP = 'http://localhost:3000/api';

return new Promise((resolve, reject) => {
  let executionId = null;
  let finalResult = null;
  const startTime = Date.now();

  // Create WebSocket connection
  const ws = new WebSocket(AGENT_FRAMEWORK_WS);

  // Set timeout
  const timeout = setTimeout(() => {
    ws.close();
    reject(new Error('Execution timeout after 5 minutes'));
  }, 300000); // 5 minutes

  ws.on('open', async () => {
    console.log('WebSocket connected to Agent Framework');

    try {
      // Start execution via HTTP API
      const executeUrl = type === 'crew' 
        ? `${AGENT_FRAMEWORK_HTTP}/crews/execute`
        : `${AGENT_FRAMEWORK_HTTP}/agents/execute`;

      const executeResponse = await fetch(executeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          configPath,
          [type === 'crew' ? 'input' : 'task']: task,
          options: {
            streaming: true,
            timeout: 180000
          }
        })
      });

      const executeResult = await executeResponse.json();
      executionId = executeResult.executionId;

      console.log(`Started ${type} execution: ${executionId}`);

      // Subscribe to execution updates via WebSocket
      ws.send(JSON.stringify({
        id: `n8n-${Date.now()}`,
        type: 'subscribe_execution',
        data: {
          executionId,
          type
        }
      }));

    } catch (error) {
      clearTimeout(timeout);
      ws.close();
      reject(error);
    }
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      console.log('WebSocket message received:', message.type);

      switch (message.type) {
        case 'subscription_confirmed':
          console.log('Subscribed to execution updates');
          break;

        case 'execution_progress':
          const { status, progress, currentStep, error } = message.data;
          
          console.log(`Execution ${status}: ${Math.round((progress || 0) * 100)}%${currentStep ? ` - ${currentStep}` : ''}`);

          if (status === 'completed') {
            finalResult = message.data.result;
            clearTimeout(timeout);
            ws.close();
            
            resolve([{
              json: {
                executionId,
                status: 'completed',
                result: finalResult,
                executionTime: Date.now() - startTime,
                type,
                configPath,
                completedAt: new Date().toISOString()
              }
            }]);
          }

          if (status === 'failed') {
            clearTimeout(timeout);
            ws.close();
            reject(new Error(`Execution failed: ${error || 'Unknown error'}`));
          }
          break;

        case 'error':
          clearTimeout(timeout);
          ws.close();
          reject(new Error(`WebSocket error: ${message.data.message}`));
          break;
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  });

  ws.on('error', (error) => {
    clearTimeout(timeout);
    reject(new Error(`WebSocket error: ${error.message}`));
  });

  ws.on('close', () => {
    clearTimeout(timeout);
    console.log('WebSocket connection closed');
    
    // If we haven't resolved yet, this might be an unexpected close
    if (!finalResult && executionId) {
      reject(new Error('WebSocket connection closed unexpectedly'));
    }
  });
});