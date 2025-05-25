// Firebase imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc,
    collection, 
    query, 
    where, 
    getDocs,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Import Firebase config
import { firebaseConfig } from './config.js';

// Initialize Firebase
let auth;
let db;

async function initializeFirebase() {
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        // Make Firebase available globally
        window.auth = auth;
        window.db = db;
        window.firebase = {
            signInWithEmailAndPassword,
            signOut,
            doc,
            getDoc,
            updateDoc,
            collection,
            query,
            where,
            getDocs,
            serverTimestamp
        };

        // Auth state observer
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Check if user is admin
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                const userData = userDoc.data();
                
                if (!userData || !userData.isAdmin) {
                    alert('Access denied. Admin privileges required.');
                    signOut(auth);
                    return;
                }
                
                // Load dashboard data
                loadDashboardData();
            } else {
                // Redirect to login if not authenticated
                window.location.href = '/admin-login.html';
            }
        });

        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Error initializing Firebase:', error);
    }
}

// Initialize Firebase when the page loads
initializeFirebase();

// Function to update question points
async function updateQuestionPoints(submissionId, questionIndex, points, comment) {
    try {
        console.log('Updating points for submission:', submissionId, 'question:', questionIndex);
        const submissionRef = doc(db, 'quiz_submissions', submissionId);
        const submissionDoc = await getDoc(submissionRef);
        
        if (!submissionDoc.exists()) {
            throw new Error('Submission not found');
        }

        const submission = submissionDoc.data();
        const questionResults = [...submission.questionResults];
        
        // Update the specific question
        questionResults[questionIndex] = {
            ...questionResults[questionIndex],
            points: parseInt(points) || 0,
            comment: comment || '',
            isCorrect: parseInt(points) > 0
        };

        // Calculate new total score and percentage
        const totalScore = questionResults.reduce((sum, result) => sum + (parseInt(result.points) || 0), 0);
        const maxScore = questionResults.reduce((sum, result) => sum + (parseInt(result.maxPoints) || 0), 0);
        const percentage = Math.round((totalScore / maxScore) * 100);

        // Update the submission
        await updateDoc(submissionRef, {
            questionResults: questionResults,
            score: totalScore,
            percentage: percentage,
            gradedAt: serverTimestamp(),
            gradedBy: auth.currentUser.uid,
            status: 'graded'
        });

        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
        successMessage.textContent = 'Points updated successfully!';
        document.body.appendChild(successMessage);
        
        // Remove success message after 2 seconds
        setTimeout(() => {
            successMessage.remove();
        }, 2000);

        // Refresh the submission view
        await viewSubmission(submissionId);

    } catch (error) {
        console.error('Error updating submission:', error);
        alert('Error updating points: ' + error.message);
    }
}

// Function to toggle submission status
async function toggleSubmissionStatus(submissionId, currentStatus) {
    try {
        const submissionRef = doc(db, 'quiz_submissions', submissionId);
        const newStatus = currentStatus === 'pending_review' ? 'graded' : 'pending_review';
        
        await updateDoc(submissionRef, {
            status: newStatus,
            updatedAt: serverTimestamp()
        });

        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
        successMessage.textContent = `Status updated to ${newStatus === 'graded' ? 'Graded' : 'Pending Review'}`;
        document.body.appendChild(successMessage);
        
        // Remove success message after 2 seconds
        setTimeout(() => {
            successMessage.remove();
        }, 2000);

        // Refresh the submission view
        await viewSubmission(submissionId);
        // Refresh the dashboard to update the list
        await loadDashboardData();
    } catch (error) {
        console.error('Error toggling submission status:', error);
        alert('Error updating status: ' + error.message);
    }
}

// Function to view submission details
async function viewSubmission(submissionId) {
    try {
        console.log('Viewing submission:', submissionId);
        const submissionRef = doc(db, 'quiz_submissions', submissionId);
        const submissionDoc = await getDoc(submissionRef);
        
        if (!submissionDoc.exists()) {
            alert('Submission not found');
            return;
        }
        
        const submission = submissionDoc.data();
        const modalContent = document.getElementById('submissionModalContent');
        
        // Create a scrollable container for the submission details
        modalContent.innerHTML = `
            <div class="space-y-6">
                <div class="bg-gray-50 p-4 rounded-lg">
                    <div class="flex justify-between items-center">
                        <div>
                            <h4 class="font-semibold text-gray-900">Student Information</h4>
                            <p class="text-gray-600">Name: ${submission.userName || 'N/A'}</p>
                            <p class="text-gray-600">Chapter: ${submission.chapterTitle || 'N/A'}</p>
                            <p class="text-gray-600">Submitted: ${submission.submittedAt ? new Date(submission.submittedAt.toDate()).toLocaleString() : 'N/A'}</p>
                        </div>
                        <div class="text-right">
                            <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                submission.status === 'graded' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }">
                                ${submission.status === 'graded' ? 'Graded' : 'Pending Review'}
                            </span>
                            <button onclick="toggleSubmissionStatus('${submissionId}', '${submission.status}')" 
                                    class="mt-2 button ${submission.status === 'graded' ? 'button-secondary' : 'button-primary'}">
                                ${submission.status === 'graded' ? 'Mark as Pending' : 'Mark as Graded'}
                            </button>
                        </div>
                    </div>
                </div>

                <div class="space-y-4">
                    <h4 class="font-semibold text-gray-900">Quiz Results</h4>
                    ${submission.questionResults.map((result, index) => `
                        <div class="bg-white p-4 rounded-lg border border-gray-200">
                            <div class="flex justify-between items-start mb-2">
                                <h5 class="font-medium text-gray-900">Question ${index + 1}</h5>
                                <div class="flex items-center space-x-2">
                                    <input type="number" 
                                           id="points-${submissionId}-${index}"
                                           value="${result.points || 0}"
                                           min="0"
                                           max="${result.maxPoints}"
                                           class="w-20 px-2 py-1 border border-gray-300 rounded"
                                           onchange="updateQuestionPoints('${submissionId}', ${index}, this.value, document.getElementById('comment-${submissionId}-${index}').value)">
                                    <span class="text-gray-500">/ ${result.maxPoints}</span>
                                </div>
                            </div>
                            <div class="mb-2">
                                <p class="text-gray-700">${result.question}</p>
                            </div>
                            <div class="mb-2">
                                <p class="text-gray-600">Student's Answer: ${result.userAnswer || 'No answer provided'}</p>
                            </div>
                            <div class="mb-2">
                                <p class="text-gray-600">Correct Answer: ${result.correctAnswer}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Comments:</label>
                                <textarea id="comment-${submissionId}-${index}"
                                          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                          rows="2"
                                          onchange="updateQuestionPoints('${submissionId}', ${index}, document.getElementById('points-${submissionId}-${index}').value, this.value)">${result.comment || ''}</textarea>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-gray-900 mb-2">Overall Results</h4>
                    <p class="text-gray-600">Total Score: ${submission.score || 0} / ${submission.maxScore || 0}</p>
                    <p class="text-gray-600">Percentage: ${submission.percentage || 0}%</p>
                </div>

                <div class="flex justify-end space-x-4">
                    <button onclick="exportSubmission('${submissionId}')" class="button button-secondary">
                        Export
                    </button>
                    <button onclick="document.getElementById('submissionModal').classList.add('hidden')" class="button button-primary">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Show the modal
        document.getElementById('submissionModal').classList.remove('hidden');
    } catch (error) {
        console.error('Error viewing submission:', error);
        alert('Error loading submission details: ' + error.message);
    }
}

// Function to load dashboard data
async function loadDashboardData() {
    try {
        console.log('Loading dashboard data...');
        
        const submissionsRef = collection(db, 'quiz_submissions');
        const querySnapshot = await getDocs(submissionsRef);
        
        console.log('Received snapshot with', querySnapshot.size, 'documents');
        
        const submissionsList = document.getElementById('submissionsList');
        submissionsList.innerHTML = '';
        
        let totalSubmissions = 0;
        let pendingSubmissions = 0;
        let gradedSubmissions = 0;
        
        // Get filter values
        const currentFilter = document.querySelector('input[name="submissionFilter"]:checked').value;
        const chapterFilter = document.getElementById('chapterFilter').value;
        const searchEmail = document.getElementById('searchEmail').value.toLowerCase();
        
        // Get unique chapters for the filter dropdown
        const chapters = new Set();
        querySnapshot.forEach(doc => {
            const submission = doc.data();
            if (submission.chapterTitle) {
                chapters.add(submission.chapterTitle);
            }
        });
        
        // Update chapter filter options if needed
        const chapterFilterSelect = document.getElementById('chapterFilter');
        if (chapterFilterSelect.options.length <= 2) { // Only update if we haven't populated it yet
            chapters.forEach(chapter => {
                if (!Array.from(chapterFilterSelect.options).some(option => option.value === chapter)) {
                    const option = document.createElement('option');
                    option.value = chapter;
                    option.textContent = chapter;
                    chapterFilterSelect.appendChild(option);
                }
            });
        }
        
        querySnapshot.forEach((doc) => {
            const submission = { id: doc.id, ...doc.data() };
            console.log('Processing submission:', submission);
            
            // Apply filters
            if (currentFilter === 'pending' && submission.status !== 'pending_review') return;
            if (currentFilter === 'graded' && submission.status !== 'graded') return;
            if (chapterFilter !== 'all' && submission.chapterTitle !== chapterFilter) return;
            if (searchEmail && (!submission.userEmail || !submission.userEmail.toLowerCase().includes(searchEmail))) return;
            
            totalSubmissions++;
            if (submission.status === 'pending_review') {
                pendingSubmissions++;
            } else if (submission.status === 'graded') {
                gradedSubmissions++;
            }
            
            const submissionElement = document.createElement('div');
            submissionElement.className = 'bg-white p-4 rounded-lg shadow mb-4';
            submissionElement.innerHTML = `
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="font-semibold">${submission.userName || 'Anonymous'}</h3>
                        <p class="text-sm text-gray-600">${submission.chapterTitle || 'Untitled Chapter'}</p>
                        <p class="text-sm text-gray-500">${submission.userEmail || 'No email provided'}</p>
                        <p class="text-sm ${submission.status === 'graded' ? 'text-green-600' : 'text-yellow-600'}">
                            ${submission.status === 'graded' ? 'Graded' : 'Pending Review'}
                        </p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm text-gray-600">Submitted: ${submission.submittedAt ? new Date(submission.submittedAt.toDate()).toLocaleString() : 'N/A'}</p>
                        <button onclick="viewSubmission('${doc.id}')" 
                                class="button button-primary mt-2">
                            ${submission.status === 'graded' ? 'View Submission' : 'Grade Submission'}
                        </button>
                    </div>
                </div>
            `;
            
            submissionsList.appendChild(submissionElement);
        });
        
        console.log('Total submissions found:', totalSubmissions);
        console.log('Submissions with pending review:', pendingSubmissions);
        console.log('Graded submissions:', gradedSubmissions);
        
        // Update dashboard stats
        document.getElementById('totalSubmissions').textContent = totalSubmissions;
        document.getElementById('pendingSubmissions').textContent = pendingSubmissions;
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        alert('Error loading dashboard data: ' + error.message);
    }
}

// Add event listeners for filter changes
document.addEventListener('DOMContentLoaded', () => {
    const filterInputs = document.querySelectorAll('input[name="submissionFilter"]');
    filterInputs.forEach(input => {
        input.addEventListener('change', loadDashboardData);
    });
    
    // Add event listener for chapter filter
    document.getElementById('chapterFilter').addEventListener('change', loadDashboardData);
    
    // Add event listener for search input (with debounce)
    let searchTimeout;
    document.getElementById('searchEmail').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadDashboardData();
        }, 300);
    });
});

// Function to export submission as PDF
async function exportSubmission(submissionId) {
    try {
        const submissionRef = doc(db, 'quiz_submissions', submissionId);
        const submissionDoc = await getDoc(submissionRef);
        
        if (!submissionDoc.exists()) {
            throw new Error('Submission not found');
        }

        const submission = submissionDoc.data();
        
        // Create new PDF document
        const { jsPDF } = window.jspdf;
        const pdfDoc = new jsPDF();
        
        // Set margins
        const margin = 20;
        const pageWidth = pdfDoc.internal.pageSize.width;
        const pageHeight = pdfDoc.internal.pageSize.height;
        const contentWidth = pageWidth - (2 * margin);
        
        // Function to add text with word wrap and page breaks
        function addTextWithWrap(text, x, y, maxWidth, fontSize = 10) {
            pdfDoc.setFontSize(fontSize);
            const lines = pdfDoc.splitTextToSize(text, maxWidth);
            
            // Check if we need a new page
            const lineHeight = fontSize * 0.35;
            const totalHeight = lines.length * lineHeight;
            
            if (y + totalHeight > pageHeight - margin) {
                pdfDoc.addPage();
                y = margin;
            }
            
            pdfDoc.text(lines, x, y);
            return y + totalHeight + 5; // Return new y position
        }
        
        // Add title
        pdfDoc.setFontSize(20);
        pdfDoc.text('Quiz Submission Report', pageWidth / 2, margin, { align: 'center' });
        let yPosition = margin + 15;
        
        // Add student information
        yPosition = addTextWithWrap(`Student: ${submission.userName || 'Anonymous'}`, margin, yPosition, contentWidth, 12);
        yPosition = addTextWithWrap(`Chapter: ${submission.chapterTitle || 'Untitled Chapter'}`, margin, yPosition, contentWidth, 12);
        yPosition = addTextWithWrap(`Submitted: ${submission.submittedAt ? new Date(submission.submittedAt.toDate()).toLocaleString() : 'N/A'}`, margin, yPosition, contentWidth, 12);
        
        yPosition += 10; // Add some space
        
        // Add score summary
        pdfDoc.setFontSize(14);
        pdfDoc.text('Score Summary', margin, yPosition);
        yPosition += 10;
        
        yPosition = addTextWithWrap(`Total Score: ${submission.score || 0} / ${submission.maxScore || 0}`, margin, yPosition, contentWidth, 12);
        yPosition = addTextWithWrap(`Percentage: ${submission.percentage || 0}%`, margin, yPosition, contentWidth, 12);
        
        yPosition += 15; // Add some space
        
        // Add questions and answers
        pdfDoc.setFontSize(14);
        pdfDoc.text('Question Details', margin, yPosition);
        yPosition += 10;
        
        submission.questionResults.forEach((result, index) => {
            // Add question number
            pdfDoc.setFontSize(12);
            pdfDoc.text(`Question ${index + 1}`, margin, yPosition);
            yPosition += 7;
            
            // Add question text
            yPosition = addTextWithWrap(result.question, margin + 5, yPosition, contentWidth - 10);
            
            // Add student's answer
            pdfDoc.setFontSize(10);
            pdfDoc.text('Student\'s Answer:', margin + 5, yPosition);
            yPosition += 5;
            yPosition = addTextWithWrap(result.userAnswer || 'No answer provided', margin + 10, yPosition, contentWidth - 15);
            
            // Add correct answer
            pdfDoc.text('Correct Answer:', margin + 5, yPosition);
            yPosition += 5;
            yPosition = addTextWithWrap(result.correctAnswer, margin + 10, yPosition, contentWidth - 15);
            
            // Add points
            yPosition = addTextWithWrap(`Points: ${result.points || 0} / ${result.maxPoints}`, margin + 5, yPosition, contentWidth - 10);
            
            // Add comments if they exist
            if (result.comment) {
                pdfDoc.text('Comments:', margin + 5, yPosition);
                yPosition += 5;
                yPosition = addTextWithWrap(result.comment, margin + 10, yPosition, contentWidth - 15);
            }
            
            yPosition += 10; // Add space between questions
            
            // Add separator line if not at the bottom of the page
            if (yPosition < pageHeight - margin) {
                pdfDoc.setDrawColor(200, 200, 200);
                pdfDoc.line(margin, yPosition, pageWidth - margin, yPosition);
                yPosition += 10;
            }
        });
        
        // Save the PDF
        pdfDoc.save(`quiz-submission-${submissionId}.pdf`);
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
        successMessage.textContent = 'PDF exported successfully!';
        document.body.appendChild(successMessage);
        
        // Remove success message after 2 seconds
        setTimeout(() => {
            successMessage.remove();
        }, 2000);
        
    } catch (error) {
        console.error('Error exporting submission:', error);
        alert('Error exporting submission: ' + error.message);
    }
}

// Make functions available globally
window.updateQuestionPoints = updateQuestionPoints;
window.viewSubmission = viewSubmission;
window.loadDashboardData = loadDashboardData;
window.exportSubmission = exportSubmission;
window.toggleSubmissionStatus = toggleSubmissionStatus;

// Handle logout
document.getElementById('logoutButton').addEventListener('click', () => {
    signOut(auth);
});