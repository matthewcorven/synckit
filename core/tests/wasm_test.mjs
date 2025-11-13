// Node.js test for SyncKit WASM module
// Run with: node tests/wasm_test.mjs

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function test() {
    try {
        // Load the WASM module (must be built first with scripts/build-wasm.ps1)
        const wasmPath = join(__dirname, '../pkg-nodejs/synckit_core_bg.wasm');
        const wasmBuffer = readFileSync(wasmPath);
        
        const { 
            init_panic_hook, 
            WasmDocument, 
            WasmVectorClock, 
            WasmDelta 
        } = await import('../pkg-nodejs/synckit_core.js');
        
        console.log('✅ WASM Module Loaded\n');
        
        // Initialize panic hook for better error messages
        init_panic_hook();
        
        // Test Document
        console.log('--- Testing Document ---');
        const doc = new WasmDocument('test-doc-1');
        console.log(`✅ Created document: ${doc.getId()}`);
        
        doc.setField('name', JSON.stringify('Alice'), 1n, 'client-1');
        doc.setField('age', JSON.stringify(30), 2n, 'client-1');
        console.log(`✅ Set fields. Count: ${doc.fieldCount()}`);
        
        const name = doc.getField('name');
        console.log(`✅ Got field 'name': ${name}\n`);
        
        // Test VectorClock
        console.log('--- Testing VectorClock ---');
        const vc = new WasmVectorClock();
        vc.tick('client-1');
        vc.tick('client-1');
        const clock = vc.get('client-1');
        console.log(`✅ VectorClock for client-1: ${clock}\n`);
        
        // Test Delta
        console.log('--- Testing Delta ---');
        const doc2 = new WasmDocument('test-doc-1');
        doc2.setField('name', JSON.stringify('Alice'), 1n, 'client-1');
        doc2.setField('age', JSON.stringify(31), 3n, 'client-1');
        doc2.setField('city', JSON.stringify('NYC'), 4n, 'client-1');
        
        const delta = WasmDelta.compute(doc, doc2);
        console.log(`✅ Computed delta with ${delta.changeCount()} changes`);
        
        delta.applyTo(doc, 'client-1');
        console.log(`✅ Applied delta. New field count: ${doc.fieldCount()}`);
        
        const json = doc.toJSON();
        console.log(`✅ Document JSON:\n${json}\n`);
        
        console.log('✅ All Tests Passed!');
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

test();
