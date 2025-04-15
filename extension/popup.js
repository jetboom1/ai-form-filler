document.addEventListener('DOMContentLoaded', function() {
    // Generate a unique user ID or retrieve from storage
    chrome.storage.local.get(['userId'], function(result) {
      if (!result.userId) {
        const userId = 'user_' + Math.random().toString(36).substring(2, 15);
        chrome.storage.local.set({userId: userId});
      }
    });
    
    // Detect form on page
    document.getElementById('detectForm').addEventListener('click', function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "detectForm"}, function(response) {
          if (response && response.formDetected) {
            document.getElementById('formStatus').textContent = 
              `Form detected with ${response.fieldCount} fields.`;
          } else {
            document.getElementById('formStatus').textContent = 
              'No form detected on this page.';
          }
        });
      });
    });
    
    // Fill form with AI
    document.getElementById('fillForm').addEventListener('click', function() {
      chrome.storage.local.get(['userId'], function(result) {
        const userId = result.userId;
        
        document.getElementById('formStatus').textContent = 'Filling form...';
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "fillForm",
            userId: userId
          }, function(response) {
            if (response && response.success) {
              document.getElementById('formStatus').textContent = 
                `Form filled with ${response.filledCount} fields. ${response.warningCount} fields needed your attention.`;
            } else {
              document.getElementById('formStatus').textContent = 
                'Failed to fill form. ' + (response ? response.error : '');
            }
          });
        });
      });
    });
    
    // Add text data
    document.getElementById('addText').addEventListener('click', function() {
      const text = document.getElementById('userText').value;
      
      if (!text) {
        document.getElementById('uploadStatus').textContent = 'Please enter some text.';
        return;
      }
      
      chrome.storage.local.get(['userId'], function(result) {
        const userId = result.userId;
        
        document.getElementById('uploadStatus').textContent = 'Adding text data...';
        
        fetch('http://localhost:5001/upload_text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: text,
            user_id: userId
          }),
        })
        .then(response => response.json())
        .then(data => {
          if (data.status === 'success') {
            document.getElementById('uploadStatus').textContent = 
              `Added text data (${data.chunks_processed} chunks processed).`;
            document.getElementById('userText').value = '';
          } else {
            document.getElementById('uploadStatus').textContent = 
              'Failed to add text: ' + (data.error || 'Unknown error');
          }
        })
        .catch(error => {
          document.getElementById('uploadStatus').textContent = 
            'Error: ' + error.message;
        });
      });
    });
    
    // Upload file
    document.getElementById('uploadFile').addEventListener('click', function() {
      const fileInput = document.getElementById('userFile');
      
      if (!fileInput.files || fileInput.files.length === 0) {
        document.getElementById('uploadStatus').textContent = 'Please select a file.';
        return;
      }
      
      const file = fileInput.files[0];
      
      chrome.storage.local.get(['userId'], function(result) {
        const userId = result.userId;
        
        document.getElementById('uploadStatus').textContent = 'Uploading file...';
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', userId);
        
        fetch('http://localhost:5001/upload_file', {
          method: 'POST',
          body: formData,
        })
        .then(response => response.json())
        .then(data => {
          if (data.status === 'success') {
            document.getElementById('uploadStatus').textContent = 
              `Uploaded file (${data.chunks_processed} chunks processed).`;
            fileInput.value = '';
          } else {
            document.getElementById('uploadStatus').textContent = 
              'Failed to upload file: ' + (data.error || 'Unknown error');
          }
        })
        .catch(error => {
          document.getElementById('uploadStatus').textContent = 
            'Error: ' + error.message;
        });
      });
    });
    
    // Clear data
    document.getElementById('clearData').addEventListener('click', function() {
      if (confirm('Are you sure you want to clear all your data?')) {
        chrome.storage.local.get(['userId'], function(result) {
          const userId = result.userId;
          
          document.getElementById('uploadStatus').textContent = 'Clearing data...';
          
          fetch('http://localhost:5001/clear_data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: userId
            }),
          })
          .then(response => response.json())
          .then(data => {
            if (data.status === 'success') {
              document.getElementById('uploadStatus').textContent = 'All data cleared.';
            } else {
              document.getElementById('uploadStatus').textContent = 
                'Failed to clear data: ' + (data.error || 'Unknown error');
            }
          })
          .catch(error => {
            document.getElementById('uploadStatus').textContent = 
              'Error: ' + error.message;
          });
        });
      }
    });
  });