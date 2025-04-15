// popup.html


// popup.js


// content.js
// This script runs in the context of web pages

// Keep track of form fields and their info
let formFields = [];

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "detectForm") {
    // Detect form fields on the page
    const fields = detectFormFields();
    formFields = fields;
    
    sendResponse({
      formDetected: fields.length > 0,
      fieldCount: fields.length
    });
    
  } else if (request.action === "fillForm") {
    // Fill the form using AI
    fillFormWithAI(request.userId)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({
        success: false, 
        error: error.message
      }));
    
    // Indicate we'll send a response asynchronously
    return true;
  }
});

// Detect form fields on the page
function detectFormFields() {
  console.log('🔍 Starting form field detection');
  const fields = [];
  const isGoogleForm = window.location.href.includes('docs.google.com/forms') || 
                       document.querySelector('form[id="mG61Hd"]') !== null;
  
  console.log(`🔍 Google Form detected: ${isGoogleForm}`);
  
  // Google Forms detection
  if (isGoogleForm) {
    console.log('🔍 Using Google Forms detection strategy');
    // Find questions by container structure
    const questions = Array.from(document.querySelectorAll('[role="listitem"], div[jscontroller="sWGJ4b"]'));
    console.log(`🔍 Found ${questions.length} potential question containers`);
    
    questions.forEach((container, index) => {
      console.log(`🔍 Processing question container ${index + 1}/${questions.length}`);
      
      // Get question text from heading
      const heading = container.querySelector('[role="heading"]');
      if (!heading) {
        console.log(`⚠️ No heading found in container ${index + 1}, skipping`);
        return;
      }
      
      const questionText = heading.textContent.trim();
      console.log(`🔍 Found question: "${questionText}"`);
      
      // Find the appropriate input field
      const textInput = container.querySelector('input[type="text"]');
      const textarea = container.querySelector('textarea');
      const radioGroup = container.querySelector('[role="radiogroup"]');
      const checkboxes = container.querySelectorAll('[role="checkbox"]');
      const dropdown = container.querySelector('[role="listbox"]');
      
      console.log(`🔍 Field types found: ${
        [
          textInput ? 'text input' : '',
          textarea ? 'textarea' : '',
          radioGroup ? 'radio group' : '',
          checkboxes.length > 0 ? 'checkboxes' : '',
          dropdown ? 'dropdown' : ''
        ].filter(Boolean).join(', ') || 'none'
      }`);
      
      // Text input
      if (textInput) {
        console.log(`✅ Adding text input field for "${questionText}"`);
        fields.push({
          element: textInput,
          label: questionText,
          type: 'text'
        });
      } 
      // Textarea
      else if (textarea) {
        console.log(`✅ Adding textarea field for "${questionText}"`);
        fields.push({
          element: textarea,
          label: questionText,
          type: 'textarea'
        });
      } 
      // Radio buttons
      else if (radioGroup) {
        const options = Array.from(container.querySelectorAll('[role="radio"]'))
          .map(radio => {
            // Find label text near the radio button
            const span = radio.closest('label')?.querySelector('span');
            const text = span?.textContent.trim() || '';
            return {
              element: radio,
              text: text,
              value: radio.getAttribute('data-value') || text
            };
          })
          .filter(opt => opt.text && !opt.text.includes('Other:'));
        
        console.log(`✅ Adding radio group for "${questionText}" with ${options.length} options`);
        if (options.length > 0) {
          console.log(`🔍 Radio options: ${options.map(o => o.text).join(', ')}`);
        }
        
        fields.push({
          element: radioGroup,
          label: questionText,
          type: 'radio',
          options: options
        });
      } 
      // Checkboxes
      else if (checkboxes.length > 0) {
        const options = Array.from(checkboxes).map(checkbox => {
          const span = checkbox.closest('label')?.querySelector('span');
          const text = span?.textContent.trim() || '';
          return {
            element: checkbox,
            text: text,
            value: checkbox.getAttribute('data-answer-value') || text
          };
        }).filter(opt => opt.text);
        
        console.log(`✅ Adding checkbox group for "${questionText}" with ${options.length} options`);
        if (options.length > 0) {
          console.log(`🔍 Checkbox options: ${options.map(o => o.text).join(', ')}`);
        }
        
        fields.push({
          element: checkboxes[0].closest('[role="list"]') || container,
          label: questionText,
          type: 'checkbox',
          options: options
        });
      } 
      // Dropdown
      else if (dropdown) {
        const options = Array.from(dropdown.querySelectorAll('[role="option"]'))
          .filter(opt => opt.textContent.trim() !== 'Choose')
          .map(option => ({
            element: option,
            text: option.textContent.trim(),
            value: option.getAttribute('data-value') || option.textContent.trim()
          }));
        
        console.log(`✅ Adding dropdown for "${questionText}" with ${options.length} options`);
        if (options.length > 0) {
          console.log(`🔍 Dropdown options: ${options.map(o => o.text).join(', ')}`);
        }
        
        fields.push({
          element: dropdown,
          label: questionText,
          type: 'select',
          options: options
        });
      } else {
        console.log(`⚠️ No supported field type found for "${questionText}"`);
      }
    });
  }
  
  // If no Google Form fields found, use generic form detection
  if (fields.length === 0) {
    console.log('🔍 No Google Form fields found, using generic form detection');
    // Find all inputs, textareas, and selects
    const inputs = document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea');
    const selects = document.querySelectorAll('select');
    
    console.log(`🔍 Found ${inputs.length} input/textarea fields and ${selects.length} select fields`);
    
    // Process text inputs and textareas
    let inputCounter = 0;
    inputs.forEach(input => {
      inputCounter++;
      console.log(`🔍 Processing input field ${inputCounter}/${inputs.length}`);
      const labelText = findLabelText(input);
      if (labelText) {
        const type = input.tagName.toLowerCase() === 'textarea' ? 'textarea' : (input.type || 'text');
        console.log(`✅ Adding ${type} field: "${labelText}"`);
        fields.push({
          element: input,
          label: labelText,
          type: type
        });
      } else {
        console.log(`⚠️ No label found for input field ${inputCounter}, skipping`);
      }
    });
    
    // Process selects
    let selectCounter = 0;
    selects.forEach(select => {
      selectCounter++;
      console.log(`🔍 Processing select field ${selectCounter}/${selects.length}`);
      const labelText = findLabelText(select);
      if (labelText) {
        const options = Array.from(select.options)
          .filter(opt => opt.value !== '')
          .map(opt => opt.text);
        
        console.log(`✅ Adding select field: "${labelText}" with ${options.length} options`);
        fields.push({
          element: select,
          label: labelText,
          type: 'select',
          options: options
        });
      } else {
        console.log(`⚠️ No label found for select field ${selectCounter}, skipping`);
      }
    });
    
    // Find radio and checkbox groups
    console.log('🔍 Looking for radio and checkbox groups');
    findInputGroups(fields);
  }
  
  console.log(`🎉 Total fields identified: ${fields.length}`);
  if (fields.length > 0) {
    console.log('📋 Field summary:');
    fields.forEach((field, i) => {
      console.log(`  ${i+1}. ${field.type}: "${field.label}"`);
    });
    
    // Add detailed debug view of fields array structure
    console.log('🔍 DETAILED FIELDS STRUCTURE:');
    fields.forEach((field, i) => {
      // Create a clean representation of the field for logging
      const cleanField = {
        index: i,
        type: field.type,
        label: field.label,
        elementType: field.element.tagName,
        elementId: field.element.id || '(no id)',
      };
      
      // Add options array for multi-choice fields
      if (field.options) {
        cleanField.optionCount = field.options.length;
        cleanField.options = field.options.map(opt => ({
          text: opt.text,
          value: opt.value
        }));
      }
      
      // Log the clean field object
      console.log(`Field ${i+1}:`, cleanField);
    });
    
    // Log the complete structure as JSON if needed
    console.log('🔍 Complete fields array (for copying):');
    console.log(JSON.stringify(
      fields.map(field => {
        // Create a clean object without circular references to DOM elements
        const cleanField = {
          type: field.type,
          label: field.label
        };
        
        if (field.options) {
          cleanField.options = field.options.map(opt => ({
            text: opt.text,
            value: opt.value
          }));
        }
        
        return cleanField;
      }), 
      null, 2)
    );
  }
  
  return fields;
}

// Helper function to find label text for an element
function findLabelText(element) {
  console.log(`🔍 Finding label for element: ${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}`);
  
  // 1. Try to find associated label by id
  if (element.id) {
    console.log(`🔍 Checking for label with for="${element.id}"`);
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) {
      const text = label.textContent.trim();
      console.log(`✓ Found label by ID: "${text}"`);
      return text;
    }
  }
  
  // 2. Check if inside a label
  console.log('🔍 Checking if element is inside a label');
  const parentLabel = element.closest('label');
  if (parentLabel) {
    // Get text that's not from the input itself
    const text = Array.from(parentLabel.childNodes)
      .filter(node => node !== element && node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent.trim())
      .join(' ')
      .trim();
    if (text) {
      console.log(`✓ Found label as parent: "${text}"`);
      return text;
    }
  }
  
  // 3. Check ARIA attributes
  console.log('🔍 Checking ARIA attributes');
  if (element.getAttribute('aria-label')) {
    const text = element.getAttribute('aria-label').trim();
    console.log(`✓ Found aria-label: "${text}"`);
    return text;
  }
  
  const labelledById = element.getAttribute('aria-labelledby');
  if (labelledById) {
    console.log(`🔍 Checking for element with id="${labelledById}"`);
    const labelElement = document.getElementById(labelledById);
    if (labelElement) {
      const text = labelElement.textContent.trim();
      console.log(`✓ Found element by aria-labelledby: "${text}"`);
      return text;
    }
  }
  
  // 4. Try placeholder
  if (element.placeholder) {
    const text = element.placeholder;
    console.log(`✓ Using placeholder as label: "${text}"`);
    return text;
  }
  
  // 5. Try name attribute
  if (element.name) {
    const text = element.name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
    console.log(`✓ Using name attribute as label: "${text}"`);
    return text;
  }
  
  // 6. Look for nearby text
  console.log('🔍 Looking for nearby text elements');
  
  // Check previous sibling or parent heading
  let sibling = element.previousElementSibling;
  if (sibling && (sibling.tagName === 'LABEL' || sibling.tagName.match(/^H[1-6]$/))) {
    const text = sibling.textContent.trim();
    console.log(`✓ Found label in previous sibling (${sibling.tagName}): "${text}"`);
    return text;
  }
  
  // Check parent
  const parent = element.parentElement;
  if (parent) {
    const heading = parent.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]');
    if (heading && !heading.contains(element)) {
      const text = heading.textContent.trim();
      console.log(`✓ Found heading in parent: "${text}"`);
      return text;
    }
  }
  
  console.log('⚠️ No label found for element');
  return '';
}

// Find radio and checkbox groups
function findInputGroups(fields) {
  console.log('🔍 Finding input groups (radio buttons and checkboxes)');
  
  // Group radios by name
  const radioGroups = {};
  const allRadios = document.querySelectorAll('input[type="radio"]');
  console.log(`🔍 Found ${allRadios.length} radio buttons`);
  
  allRadios.forEach(radio => {
    if (!radio.name) return;
    if (!radioGroups[radio.name]) radioGroups[radio.name] = [];
    radioGroups[radio.name].push(radio);
  });
  
  console.log(`🔍 Identified ${Object.keys(radioGroups).length} radio groups by name`);
  
  // Process each radio group
  Object.entries(radioGroups).forEach(([name, radios]) => {
    console.log(`🔍 Processing radio group "${name}" with ${radios.length} options`);
    
    // Find group label from fieldset/legend or nearby heading
    let groupLabel = '';
    const fieldset = radios[0].closest('fieldset');
    
    if (fieldset?.querySelector('legend')) {
      groupLabel = fieldset.querySelector('legend').textContent.trim();
      console.log(`✓ Found group label from legend: "${groupLabel}"`);
    } else {
      // Use name as fallback
      groupLabel = name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
      console.log(`ℹ️ Using name as fallback label: "${groupLabel}"`);
    }
    
    // Get options
    console.log('🔍 Finding labels for each radio button');
    const options = radios.map((radio, i) => {
      console.log(`🔍 Finding label for radio option ${i+1}/${radios.length}`);
      const label = findLabelText(radio);
      return {
        element: radio,
        text: label || radio.value,
        value: radio.value
      };
    }).filter(opt => opt.text);
    
    if (groupLabel && options.length > 0) {
      console.log(`✅ Adding radio group: "${groupLabel}" with ${options.length} options`);
      if (options.length > 0) {
        console.log(`🔍 Radio options: ${options.map(o => o.text).join(', ')}`);
      }
      
      fields.push({
        element: fieldset || radios[0].form || document,
        label: groupLabel,
        type: 'radio',
        options: options
      });
    } else {
      console.log(`⚠️ Skipping radio group "${name}": no label or no options found`);
    }
  });
  
  // Similar approach for checkboxes with same name pattern (name[])
  const checkboxGroups = {};
  const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
  console.log(`🔍 Found ${allCheckboxes.length} checkboxes`);
  
  allCheckboxes.forEach(checkbox => {
    if (!checkbox.name) return;
    const groupName = checkbox.name.endsWith('[]') ? 
      checkbox.name.slice(0, -2) : checkbox.name;
    
    if (!checkboxGroups[groupName]) checkboxGroups[groupName] = [];
    checkboxGroups[groupName].push(checkbox);
  });
  
  console.log(`🔍 Identified ${Object.keys(checkboxGroups).length} checkbox groups by name`);
  
  // Process each checkbox group with more than one checkbox
  const multiCheckboxGroups = Object.entries(checkboxGroups)
    .filter(([_, checkboxes]) => checkboxes.length > 1);
  
  console.log(`🔍 Found ${multiCheckboxGroups.length} checkbox groups with multiple checkboxes`);
  
  multiCheckboxGroups.forEach(([name, checkboxes]) => {
    console.log(`🔍 Processing checkbox group "${name}" with ${checkboxes.length} options`);
    
    // Similar logic to radio buttons for finding label
    let groupLabel = '';
    const fieldset = checkboxes[0].closest('fieldset');
    
    if (fieldset?.querySelector('legend')) {
      groupLabel = fieldset.querySelector('legend').textContent.trim();
      console.log(`✓ Found group label from legend: "${groupLabel}"`);
    } else {
      groupLabel = name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
      console.log(`ℹ️ Using name as fallback label: "${groupLabel}"`);
    }
    
    console.log('🔍 Finding labels for each checkbox');
    const options = checkboxes.map((checkbox, i) => {
      console.log(`🔍 Finding label for checkbox option ${i+1}/${checkboxes.length}`);
      const label = findLabelText(checkbox);
      return {
        element: checkbox,
        text: label || checkbox.value,
        value: checkbox.value
      };
    }).filter(opt => opt.text);
    
    if (groupLabel && options.length > 0) {
      console.log(`✅ Adding checkbox group: "${groupLabel}" with ${options.length} options`);
      if (options.length > 0) {
        console.log(`🔍 Checkbox options: ${options.map(o => o.text).join(', ')}`);
      }
      
      fields.push({
        element: fieldset || checkboxes[0].form || document,
        label: groupLabel,
        type: 'checkbox',
        options: options
      });
    } else {
      console.log(`⚠️ Skipping checkbox group "${name}": no label or no options found`);
    }
  });
}

// Fill the form using AI
async function fillFormWithAI(userId) {
  if (formFields.length === 0) {
    formFields = detectFormFields();
  }
  
  if (formFields.length === 0) {
    return {
      success: false,
      error: "No form fields detected"
    };
  }
  
  // Get form context (URL and title)
  const formContext = {
    url: window.location.href,
    title: document.title,
    formName: detectFormName()
  };
  
  // Track results
  let filledCount = 0;
  let warningCount = 0;
  
  // Process each field
  const results = await Promise.all(formFields.map(async field => {
    try {
      // Skip fields that already have values
      if (field.element.value && field.element.value.trim() !== '') {
        return {
          field: field.label,
          status: 'skipped',
          message: 'Field already has a value'
        };
      }
      
      // Construct a good prompt for this field
      const fieldQuestion = constructFieldQuestion(field, formContext);
      
      // Ask the AI for an answer
      const response = await fetch('http://localhost:5001/answer_question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: fieldQuestion,
          user_id: userId,
          form_context: JSON.stringify(formContext),
          confidence_threshold: 0.6
        }),
      });
      
      const data = await response.json();
      
      if (data.answer) {
        // Fill the field
        field.element.value = data.answer;
        
        // Trigger change event to notify the form
        const event = new Event('input', { bubbles: true });
        field.element.dispatchEvent(event);
        
        filledCount++;
        
        // Visual feedback for the field
        highlightField(field.element, data.warning ? 'warning' : 'success');
        
        if (data.warning) {
          warningCount++;
        }
        
        return {
          field: field.label,
          status: 'filled',
          confidence: data.confidence,
          warning: data.warning
        };
      } else {
        // Could not fill this field
        highlightField(field.element, 'error');
        
        return {
          field: field.label,
          status: 'error',
          message: data.warning || 'Could not generate an answer'
        };
      }
    } catch (error) {
      console.error('Error filling field:', field.label, error);
      return {
        field: field.label,
        status: 'error',
        message: error.message
      };
    }
  }));
  
  return {
    success: true,
    filledCount,
    warningCount,
    results
  };
}

// Helper function to create a question for a specific field
function constructFieldQuestion(field, formContext) {
  let question = `What is the appropriate value for the field labeled "${field.label}"?`;
  
  // Add context about the form
  if (formContext.formName) {
    question += ` This is for a form called "${formContext.formName}".`;
  }
  
  // Add context about the field type
  if (field.type === 'select') {
    question += ` This is a dropdown/select field with the following options: ${field.options.join(', ')}.`;
  } else if (field.type === 'date') {
    question += ' This is a date field. Please format as YYYY-MM-DD.';
  } else if (field.type === 'email') {
    question += ' This is an email address field.';
  } else if (field.type === 'tel') {
    question += ' This is a phone number field.';
  }
  
  return question;
}

// Helper function to try to detect the form name
function detectFormName() {
  // Check for form element with an id or name
  const forms = document.querySelectorAll('form');
  for (const form of forms) {
    if (form.id) return form.id;
    if (form.name) return form.name;
  }
  
  // Check for heading elements near the form
  const headings = document.querySelectorAll('h1, h2, h3');
  for (const heading of headings) {
    if (heading.textContent.toLowerCase().includes('form')) {
      return heading.textContent.trim();
    }
  }
  
  // Check page title
  if (document.title) {
    return document.title;
  }
  
  return 'Unknown Form';
}

// Helper function to highlight a field based on the result
function highlightField(element, status) {
  // Remove any existing highlights
  element.classList.remove('ai-filled-success', 'ai-filled-warning', 'ai-filled-error');
  
  // Add the appropriate class
  element.classList.add(`ai-filled-${status}`);
  
  // Add some basic styles if they don't exist
  if (!document.getElementById('ai-form-filler-styles')) {
    const style = document.createElement('style');
    style.id = 'ai-form-filler-styles';
    style.textContent = `
      .ai-filled-success {
        border: 2px solid #4CAF50 !important;
        background-color: rgba(76, 175, 80, 0.1) !important;
      }
      .ai-filled-warning {
        border: 2px solid #FF9800 !important;
        background-color: rgba(255, 152, 0, 0.1) !important;
      }
      .ai-filled-error {
        border: 2px solid #F44336 !important;
        background-color: rgba(244, 67, 54, 0.1) !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Scroll the element into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// background.js