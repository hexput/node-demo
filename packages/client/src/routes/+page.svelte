<script lang="ts">
  import { onMount } from 'svelte';
  import { EditorView, basicSetup } from 'codemirror';
  import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
  import { tags } from '@lezer/highlight';
  import { StreamLanguage } from '@codemirror/language';
  import { json } from '@codemirror/lang-json';
  import { EditorState } from '@codemirror/state';

  let code = $state("// Write your code here\nvl items = [\"apple\", \"pie\", \"skip\", \"banana\", \"stop\", \"orange\"];\nvl filteredList = [];\nvl i = 0;\n\nloop item in items {\n  if item == \"stop\" {\n    end;\n  }\n  if item == \"skip\" {\n    continue;\n  }\n  \n  filteredList[i] = item;\n  i = i + 1;\n}\n\nprint(filteredList.join(\", \"));\nres filteredList;");
  let result = $state<any>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let executionTime = $state<number | null>(null);
  let editorElement: HTMLElement;
  let editorView: EditorView;
  // svelte-ignore non_reactive_update
  let resultElement: HTMLElement;
  let resultView: EditorView | null = null;

  // Define custom language highlighting
  const customLanguage = StreamLanguage.define({
    name: "customLanguage",
    token(stream, state) {
      // Skip whitespace
      if (stream.eatSpace()) return null;

      // Handle comments
      if (stream.match('//')) {
        stream.skipToEnd();
        return 'comment';
      }

      // Handle string literals
      if (stream.match(/"([^"\\]|\\.)*"/)) {
        return 'string';
      }

      // Handle number literals
      if (stream.match(/-?[0-9]+(\.[0-9]+)?/)) {
        return 'number';
      }

      // Handle keywords
      const keywords = ['vl', 'if', 'else', 'cb', 'res', 'loop', 'in', 'end', 'continue', 'keysof'];
      const word = stream.match(/[a-zA-Z_][a-zA-Z0-9_]*/);
      if (word) {
        //@ts-ignore
        const wordStr = word[0];
        if (keywords.includes(wordStr)) {
          return 'keyword';
        }
        if (wordStr === 'true' || wordStr === 'false' || wordStr === 'null') {
          return 'atom';
        }
        return 'variable';
      }

      // Handle operators and delimiters
      if (stream.match(/[!+=*\/><=(){}\[\],;:.]/)) {
        return 'operator';
      }

      // Skip any unrecognized character
      stream.next();
      return null;
    }
  });

  // Create custom theme
  const customHighlightStyle = HighlightStyle.define([
    { tag: tags.keyword, color: "#5c6bc0" },
    { tag: tags.comment, color: "#888888", fontStyle: "italic" },
    { tag: tags.string, color: "#009688" },
    { tag: tags.number, color: "#f44336" },
    { tag: tags.atom, color: "#9c27b0" },
    { tag: tags.variableName, color: "#333333" },
    { tag: tags.operator, color: "#795548" }
  ]);

  // Create JSON highlight style
  const jsonHighlightStyle = HighlightStyle.define([
    { tag: tags.propertyName, color: "#07a" },
    { tag: tags.string, color: "#690" },
    { tag: tags.number, color: "#905" },
    { tag: tags.bool, color: "#219" },
    { tag: tags.null, color: "#708" }
  ]);

  // Add resize observer to handle editor resizing
  function setupResizeObserver(element: HTMLElement, view: EditorView) {
    const resizeObserver = new ResizeObserver(() => {
      // Update CodeMirror layout when container is resized
      view.requestMeasure();
    });
    resizeObserver.observe(element);
    return resizeObserver;
  }

  onMount(() => {
    // Initialize editor
    editorView = new EditorView({
      doc: code,
      extensions: [
        basicSetup,
        customLanguage,
        syntaxHighlighting(customHighlightStyle),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            code = update.state.doc.toString();
          }
        })
      ],
      parent: editorElement
    });

    // Setup resize observer for the editor
    const editorResizeObserver = setupResizeObserver(editorElement, editorView);

    return () => {
      // Cleanup on component destruction
      editorView.destroy();
      editorResizeObserver.disconnect();
    };
  });

  async function executeCode() {
    loading = true;
    error = null;
    executionTime = null;
    
    const startTime = performance.now();
    
    try {
      const response = await fetch('http://localhost:4341/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });
      
      const data = await response.json();
      const endTime = performance.now();
      executionTime = Math.round(endTime - startTime);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to execute code');
      }
      
      result = data;
      // Update JSON view after getting result
      setTimeout(() => {
        if (result) updateJsonView(result);
      }, 0);
    } catch (e: any) {
      error = e.message || 'An error occurred';
      result = null;
    } finally {
      loading = false;
    }
  }

  function updateJsonView(jsonData: any) {
    const jsonString = JSON.stringify(jsonData?.result ?? jsonData?.error ?? jsonData, null, 2);
    
    if (resultView) {
      resultView.destroy();
    }
    
    resultView = new EditorView({
      doc: jsonString,
      extensions: [
        basicSetup,
        json(),
        syntaxHighlighting(jsonHighlightStyle),
        EditorState.readOnly.of(true),
        EditorView.theme({
          "&": { backgroundColor: "#f9fafb" },
          ".cm-content": { fontFamily: "monospace" }
        })
      ],
      parent: resultElement
    });
    
    // Setup resize observer for the result view
    if (resultView) {
      const resultResizeObserver = setupResizeObserver(resultElement, resultView);
      return () => resultResizeObserver.disconnect();
    }
  }
</script>

<div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-3xl mx-auto">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-extrabold text-gray-900 sm:text-4xl">
        Hexput Local Execution Tool 🚀
      </h1>
      <p class="mt-3 text-xl text-gray-500">
        Write your code below and click execute to run it
      </p>
    </div>
    
    <div class="bg-white shadow overflow-hidden rounded-lg">
      <div class="px-4 py-5 sm:p-6">
        <div class="mb-4">
          <label for="code" class="block text-sm font-medium text-gray-700">Your Code</label>
          <div class="mt-1">
            <!-- CodeMirror editor container with resizable attribute -->
            <div
              bind:this={editorElement} 
              class="editor-container border border-gray-300 rounded-md overflow-hidden"
            ></div>
          </div>
        </div>
        
        <div class="flex justify-center">
          <button 
            type="button" 
            onclick={executeCode} 
            disabled={loading}
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if loading}
              <div class="spinner mr-2"></div>
              Executing...
            {:else}
              Execute
            {/if}
          </button>
        </div>
        
        {#if error}
          <div class="mt-4 rounded-md bg-red-50 p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <!-- Error icon -->
                <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800">Error</h3>
                <div class="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        {/if}
        
        {#if result}
          <div class="mt-6">
            <h3 class="text-lg font-medium text-gray-900">Result</h3>
            {#if executionTime !== null}
              <div class="mt-1 text-sm text-gray-500">
                Executed in {executionTime} ms
              </div>
            {/if}
            <div class="mt-2 border border-gray-200 rounded-md overflow-hidden">
              <div bind:this={resultElement} class="result-container"></div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .spinner {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    border: 2px solid #ffffff;
    border-top-color: transparent;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Add styles for the CodeMirror editor */
  :global(.cm-editor) {
    height: 100%;
    font-family: monospace;
  }
  
  .editor-container {
    height: 300px;
    min-height: 100px;
    max-height: 800px;
    resize: vertical;
    overflow: auto;
  }

  .result-container {
    min-height: 100px;
    max-height: 400px;
    resize: vertical;
    overflow: auto;
  }
  
  :global(.result-container .cm-editor) {
    height: 100%;
  }
  
  :global(.result-container .cm-content) {
    padding: 8px;
  }
  
  :global(.result-container .cm-gutters) {
    display: none;
  }
</style>
