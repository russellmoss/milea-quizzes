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
    collection, 
    query, 
    where, 
    getDocs,
    updateDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Import Firebase config
import { firebaseConfig } from './config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global variables
let currentUser = null;
let submissions = []; // Store submissions globally
let currentSubmission = null; // Store current submission being viewed/graded

// Auth state observer
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        // Check if user is admin
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().isAdmin) {
            document.getElementById('authModal').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            loadDashboardData();
        } else {
            alert('You do not have admin access.');
            signOut(auth);
        }
    } else {
        document.getElementById('authModal').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }
});

// Load dashboard data
async function loadDashboardData() {
    try {
        console.log('Loading dashboard data...');
        const submissionsRef = collection(db, 'quiz_submissions');
        const q = query(submissionsRef);
        const querySnapshot = await getDocs(q);
        
        console.log('Received snapshot with', querySnapshot.size, 'documents');
        
        submissions = []; // Reset submissions array
        let pendingCount = 0;
        let gradedCount = 0;
        
        querySnapshot.forEach((doc) => {
            console.log('Processing submission:', doc.data());
            const submission = {
                id: doc.id,
                ...doc.data()
            };
            submissions.push(submission);
            
            if (submission.status === 'pending_review') {
                pendingCount++;
            } else {
                gradedCount++;
            }
        });
        
        console.log('Total submissions found:', submissions.length);
        console.log('Submissions with pending review:', pendingCount);
        console.log('Graded submissions:', gradedCount);
        
        updateDashboardUI();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        alert('Error loading dashboard data. Please try again.');
    }
}

function updateDashboardUI() {
    const submissionsList = document.getElementById('submissionsList');
    if (!submissionsList) {
        console.error('Submissions list element not found');
        return;
    }
    
    submissionsList.innerHTML = '';
    
    // Get filter values
    const searchEmail = document.getElementById('searchEmail')?.value.toLowerCase() || '';
    const statusFilter = document.querySelector('input[name="submissionFilter"]:checked')?.value || 'all';
    const chapterFilter = document.getElementById('chapterFilter')?.value || 'all';
    
    // Filter submissions
    const filteredSubmissions = submissions.filter(submission => {
        const matchesEmail = submission.userEmail.toLowerCase().includes(searchEmail);
        const matchesStatus = statusFilter === 'all' || 
            (statusFilter === 'pending' && submission.status === 'pending_review') ||
            (statusFilter === 'graded' && submission.status === 'graded');
        const matchesChapter = chapterFilter === 'all' || submission.chapterTitle === chapterFilter;
        
        return matchesEmail && matchesStatus && matchesChapter;
    });
    
    // Update stats
    document.getElementById('totalSubmissions').textContent = submissions.length;
    document.getElementById('pendingSubmissions').textContent = submissions.filter(s => s.status === 'pending_review').length;
    
    // Render submissions
    filteredSubmissions.forEach(submission => {
        const row = document.createElement('div');
        row.className = 'p-4 border border-gray-200 rounded-lg hover:bg-gray-50';
        
        const statusClass = submission.status === 'pending_review' ? 'text-yellow-600' : 'text-green-600';
        const statusText = submission.status === 'pending_review' ? 'Pending Review' : 'Graded';
        
        row.innerHTML = `
            <div class="flex justify-between items-center">
                <div class="flex-1">
                    <h4 class="text-lg font-semibold">${submission.userName}</h4>
                    <p class="text-sm text-gray-600">${submission.userEmail}</p>
                </div>
                <div class="flex-1">
                    <p class="text-gray-700">${submission.chapterTitle}</p>
                    <p class="text-sm text-gray-600">Score: ${submission.score}/${submission.maxScore}</p>
                </div>
                <div class="flex-1">
                    <span class="${statusClass}">${statusText}</span>
                </div>
                <div class="flex space-x-2">
                    <button onclick="viewSubmission('${submission.id}')" class="button button-secondary">View</button>
                    ${submission.status === 'pending_review' ? 
                        `<button onclick="gradeSubmission('${submission.id}')" class="button button-primary">Grade</button>` : 
                        ''}
                </div>
            </div>
        `;
        
        submissionsList.appendChild(row);
    });
}

// View submission details
window.viewSubmission = function(submissionId) {
    const submission = submissions.find(s => s.id === submissionId);
    if (!submission) {
        alert('Submission not found');
        return;
    }
    
    currentSubmission = submission;
    const modal = document.getElementById('submissionModal');
    const content = document.getElementById('submissionContent');
    
    let html = `
        <div class="space-y-4">
            <div>
                <h3 class="text-lg font-semibold">Student Information</h3>
                <p>Name: ${submission.userName}</p>
                <p>Email: ${submission.userEmail}</p>
            </div>
            <div>
                <h3 class="text-lg font-semibold">Quiz Information</h3>
                <p>Chapter: ${submission.chapterTitle}</p>
                <p>Score: ${submission.score}/${submission.maxScore}</p>
                <p>Status: ${submission.status}</p>
            </div>
            <div>
                <h3 class="text-lg font-semibold">Answers</h3>
                ${submission.questionResults.map((result, index) => `
                    <div class="mt-4 p-4 border border-gray-200 rounded-lg">
                        <h4 class="font-semibold">Question ${index + 1}</h4>
                        <p class="text-gray-700">${result.question}</p>
                        <div class="mt-2">
                            <strong>Student Answer:</strong>
                            <div class="text-gray-600 mt-1">${formatAdminUserAnswer(result)}</div>
                        </div>
                        <div class="mt-2">
                            <strong>Model Answer:</strong>
                            <div class="text-gray-600 mt-1 bg-blue-50 p-2 rounded">${Array.isArray(result.correctAnswer) ? result.correctAnswer.join(' to ') : result.correctAnswer}</div>
                        </div>
                        ${result.explanation ? `<p class="text-sm text-gray-500 mt-2">${result.explanation}</p>` : ''}
                        <div class="mt-2">
                            <strong>Points:</strong>
                            <span class="${result.isCorrect ? 'text-green-600' : 'text-red-600'}">${result.points}/${result.maxPoints}</span>
                        </div>
                        ${result.adminComment ? `
                            <div class="mt-2">
                                <strong>Admin Comment:</strong>
                                <div class="text-gray-600 mt-1 bg-gray-50 p-2 rounded">${result.adminComment}</div>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    content.innerHTML = html;
    modal.classList.remove('hidden');
};

// Grade submission
window.gradeSubmission = function(submissionId) {
    const submission = submissions.find(s => s.id === submissionId);
    if (!submission) {
        alert('Submission not found');
        return;
    }
    
    currentSubmission = submission;
    const modal = document.getElementById('submissionModal');
    const content = document.getElementById('submissionContent');
    
    let html = `
        <form id="gradeForm" class="space-y-4">
            <div>
                <h3 class="text-lg font-semibold">Student Information</h3>
                <p>Name: ${submission.userName}</p>
                <p>Email: ${submission.userEmail}</p>
            </div>
            <div>
                <h3 class="text-lg font-semibold">Quiz Information</h3>
                <p>Chapter: ${submission.chapterTitle}</p>
                <p>Current Score: ${submission.score}/${submission.maxScore}</p>
            </div>
            <div>
                <h3 class="text-lg font-semibold">Grade Answers</h3>
                ${submission.questionResults.map((result, index) => `
                    <div class="mt-4 p-4 border border-gray-200 rounded-lg">
                        <h4 class="font-semibold">Question ${index + 1}</h4>
                        <p class="text-gray-700">${result.question}</p>
                        <div class="mt-2">
                            <strong>Student Answer:</strong>
                            <div class="text-gray-600 mt-1">${formatAdminUserAnswer(result)}</div>
                        </div>
                        <div class="mt-2">
                            <strong>Model Answer:</strong>
                            <div class="text-gray-600 mt-1 bg-blue-50 p-2 rounded">${Array.isArray(result.correctAnswer) ? result.correctAnswer.join(' to ') : result.correctAnswer}</div>
                        </div>
                        ${result.explanation ? `<p class="text-sm text-gray-500 mt-2">${result.explanation}</p>` : ''}
                        <div class="mt-4 space-y-2">
                            <div>
                                <label class="block text-sm font-medium text-gray-700">Points (max ${result.maxPoints}):</label>
                                <input type="number" 
                                       name="points_${index}" 
                                       min="0" 
                                       max="${result.maxPoints}" 
                                       value="${result.points}"
                                       class="mt-1 block w-20 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700">Comments:</label>
                                <textarea name="comment_${index}" 
                                          rows="3" 
                                          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                                          placeholder="Add your feedback here...">${result.adminComment || ''}</textarea>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="flex justify-end space-x-4">
                <button type="button" 
                        onclick="closeModal()" 
                        class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                    Cancel
                </button>
                <button type="submit" 
                        class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark">
                    Submit Grade
                </button>
            </div>
        </form>
    `;
    
    content.innerHTML = html;
    modal.classList.remove('hidden');
    
    // Handle form submission
    document.getElementById('gradeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const updatedResults = submission.questionResults.map((result, index) => ({
            ...result,
            points: parseInt(formData.get(`points_${index}`)) || 0,
            adminComment: formData.get(`comment_${index}`) || ''
        }));
        
        const totalPoints = updatedResults.reduce((sum, result) => sum + result.points, 0);
        
        try {
            const submissionRef = doc(db, 'quiz_submissions', submissionId);
            await updateDoc(submissionRef, {
                questionResults: updatedResults,
                score: totalPoints,
                percentage: Math.round((totalPoints / submission.maxScore) * 100),
                status: 'graded',
                gradedAt: serverTimestamp(),
                gradedBy: currentUser.uid
            });
            
            alert('Submission graded successfully!');
            closeModal();
            loadDashboardData();
        } catch (error) {
            console.error('Error grading submission:', error);
            alert('Error grading submission. Please try again.');
        }
    });
};

// Export to PDF
window.exportToPDF = function() {
    if (!currentSubmission) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text('Quiz Submission Review', 20, 20);
    
    // Add student info
    doc.setFontSize(12);
    doc.text(`Student: ${currentSubmission.userName}`, 20, 30);
    doc.text(`Email: ${currentSubmission.userEmail}`, 20, 40);
    doc.text(`Chapter: ${currentSubmission.chapterTitle}`, 20, 50);
    doc.text(`Score: ${currentSubmission.score}/${currentSubmission.maxScore}`, 20, 60);
    
    // Add questions and answers
    let y = 80;
    currentSubmission.questionResults.forEach((result, index) => {
        // Question
        doc.setFontSize(14);
        doc.text(`Question ${index + 1}:`, 20, y);
        y += 10;
        
        doc.setFontSize(12);
        const questionLines = doc.splitTextToSize(result.question, 170);
        doc.text(questionLines, 20, y);
        y += questionLines.length * 7;
        
        // Student Answer
        doc.setFontSize(12);
        doc.text('Student Answer:', 20, y);
        y += 7;
        
        const studentAnswer = formatAdminUserAnswer(result);
        const studentAnswerLines = doc.splitTextToSize(studentAnswer, 170);
        doc.text(studentAnswerLines, 20, y);
        y += studentAnswerLines.length * 7;
        
        // Model Answer
        doc.text('Model Answer:', 20, y);
        y += 7;
        
        const modelAnswer = Array.isArray(result.correctAnswer) ? 
            result.correctAnswer.join(' to ') : 
            result.correctAnswer;
        const modelAnswerLines = doc.splitTextToSize(modelAnswer, 170);
        doc.text(modelAnswerLines, 20, y);
        y += modelAnswerLines.length * 7;
        
        // Points and Comments
        doc.text(`Points: ${result.points}/${result.maxPoints}`, 20, y);
        y += 7;
        
        if (result.adminComment) {
            doc.text('Admin Comments:', 20, y);
            y += 7;
            
            const commentLines = doc.splitTextToSize(result.adminComment, 170);
            doc.text(commentLines, 20, y);
            y += commentLines.length * 7;
        }
        
        // Add space between questions
        y += 10;
        
        // Add new page if needed
        if (y > 250) {
            doc.addPage();
            y = 20;
        }
    });
    
    // Save the PDF
    doc.save(`quiz_submission_${currentSubmission.userName}_${currentSubmission.chapterTitle}.pdf`);
};

// Close modal
window.closeModal = function() {
    document.getElementById('submissionModal').classList.add('hidden');
    currentSubmission = null;
};

// Handle login form
document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
});

// Handle logout
window.logout = function() {
    signOut(auth);
};

// Format user answer for admin view
function formatAdminUserAnswer(result) {
    if (typeof result.userAnswer === 'object' && result.userAnswer !== null) {
        if (Array.isArray(result.userAnswer)) {
            return result.userAnswer.join(' to ');
        } else if (result.userAnswer.profile1) {
            // Profile-strategy format
            return `
                Profile 1: ${result.userAnswer.profile1 || 'Not provided'}
                Strategy 1: ${result.userAnswer.strategy1 || 'Not provided'}
                Profile 2: ${result.userAnswer.profile2 || 'Not provided'}
                Strategy 2: ${result.userAnswer.strategy2 || 'Not provided'}
                Profile 3: ${result.userAnswer.profile3 || 'Not provided'}
                Strategy 3: ${result.userAnswer.strategy3 || 'Not provided'}
            `;
        }
    }
    return result.userAnswer || 'No answer provided';
}

// Add event listeners for filters
document.addEventListener('DOMContentLoaded', function() {
    // Status filter
    const statusFilters = document.querySelectorAll('input[name="submissionFilter"]');
    statusFilters.forEach(filter => {
        filter.addEventListener('change', loadDashboardData);
    });
    
    // Chapter filter
    const chapterFilter = document.getElementById('chapterFilter');
    if (chapterFilter) {
        chapterFilter.addEventListener('change', loadDashboardData);
    }
    
    // Search input
    const searchInput = document.getElementById('searchEmail');
    if (searchInput) {
        searchInput.addEventListener('input', loadDashboardData);
    }
});