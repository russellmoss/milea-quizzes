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
    serverTimestamp,
    addDoc,
    deleteDoc,
    setDoc,
    orderBy
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
let quizzes = []; // Store quizzes globally
let currentSubmission = null; // Store current submission being viewed/graded
let currentQuizId = null; // Store current quiz being edited
let questionIdCounter = 1; // For generating unique question IDs

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
            loadQuizzes();
        } else {
            alert('You do not have admin access.');
            signOut(auth);
        }
    } else {
        document.getElementById('authModal').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }
});

// Tab switching functionality
window.switchTab = function(tabName) {
    // Show/hide sections
    if (tabName === 'submissions') {
        document.getElementById('submissionsSection').style.display = 'block';
        document.getElementById('quizzesSection').style.display = 'none';
        loadDashboardData();
    } else if (tabName === 'quizzes') {
        document.getElementById('submissionsSection').style.display = 'none';
        document.getElementById('quizzesSection').style.display = 'block';
        loadQuizzes();
    }
};

// Load quizzes from Firestore
async function loadQuizzes() {
    try {
        console.log('Loading quizzes...');
        const quizzesRef = collection(db, 'quizzes');
        const q = query(quizzesRef, orderBy('chapterNumber'));
        const querySnapshot = await getDocs(q);
        
        quizzes = [];
        querySnapshot.forEach((doc) => {
            const quiz = {
                id: doc.id,
                ...doc.data()
            };
            quizzes.push(quiz);
        });
        
        console.log('Loaded quizzes:', quizzes.length);
        updateQuizzesUI();
    } catch (error) {
        console.error('Error loading quizzes:', error);
        alert('Error loading quizzes. Please try again.');
    }
}

function updateQuizzesUI() {
    const quizzesList = document.getElementById('quizzesList');
    if (!quizzesList) return;
    
    quizzesList.innerHTML = '';
    
    if (quizzes.length === 0) {
        quizzesList.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <p>No quizzes found. Create your first quiz to get started.</p>
            </div>
        `;
        return;
    }
    
    quizzes.forEach(quiz => {
        const row = document.createElement('div');
        row.className = 'p-4 border border-gray-200 rounded-lg hover:bg-gray-50';
        
        row.innerHTML = `
            <div class="flex justify-between items-center">
                <div class="flex-1">
                    <h4 class="text-lg font-semibold">Chapter ${quiz.chapterNumber}</h4>
                    <p class="text-gray-700">${quiz.title}</p>
                    <p class="text-sm text-gray-600">${quiz.questions?.length || 0} questions</p>
                </div>
                <div class="flex space-x-2">
                    <button onclick="editQuiz('${quiz.id}')" class="button button-secondary">Edit</button>
                    <button onclick="deleteQuiz('${quiz.id}')" class="button button-danger">Delete</button>
                </div>
            </div>
        `;
        
        quizzesList.appendChild(row);
    });
}

// Quiz management functions
window.createNewQuiz = function() {
    console.log('createNewQuiz called');
    currentQuizId = null;
    questionIdCounter = 1;
    
    const titleElement = document.getElementById('quizBuilderTitle');
    if (titleElement) {
        titleElement.textContent = 'Create New Quiz';
    } else {
        console.error('Quiz builder title element not found');
    }
    
    showQuizBuilder();
};

window.editQuiz = function(quizId) {
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz) {
        alert('Quiz not found');
        return;
    }
    
    currentQuizId = quizId;
    document.getElementById('quizBuilderTitle').textContent = 'Edit Quiz';
    showQuizBuilder(quiz);
};

window.deleteQuiz = function(quizId) {
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz) {
        alert('Quiz not found');
        return;
    }
    
    if (confirm(`Are you sure you want to delete "${quiz.title}"? This action cannot be undone.`)) {
        deleteQuizFromFirestore(quizId);
    }
};

async function deleteQuizFromFirestore(quizId) {
    try {
        await deleteDoc(doc(db, 'quizzes', quizId));
        alert('Quiz deleted successfully!');
        loadQuizzes();
    } catch (error) {
        console.error('Error deleting quiz:', error);
        alert('Error deleting quiz. Please try again.');
    }
}

function showQuizBuilder(quiz = null) {
    console.log('showQuizBuilder called');
    const modal = document.getElementById('quizBuilderModal');
    const content = document.getElementById('quizBuilderContent');
    
    if (!modal || !content) {
        console.error('Modal elements not found:', { modal, content });
        return;
    }
    
    console.log('Modal elements found, setting up content');
    const isEditing = quiz !== null;
    
    // Set up the form content
    content.innerHTML = `
        <form id="quizBuilderForm" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Chapter Number</label>
                    <input type="number" 
                           name="chapterNumber" 
                           min="1" 
                           value="${quiz?.chapterNumber || ''}"
                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                           required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Quiz Title</label>
                    <input type="text" 
                           name="quizTitle" 
                           value="${quiz?.title || ''}"
                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                           placeholder="e.g., Chapter 1: First Impressions Core Concepts"
                           required>
                </div>
            </div>
            
            <div>
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold">Questions</h3>
                    <div class="space-x-2">
                        <select id="questionTypeSelect" class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                            <option value="multiple-choice">Multiple Choice</option>
                            <option value="fill-blank">Fill in the Blank</option>
                            <option value="fill-blank-double">Fill in the Blank (Two Answers)</option>
                            <option value="true-false">True/False</option>
                            <option value="short-answer">Short Answer</option>
                            <option value="long-answer">Long Answer</option>
                            <option value="profile-strategy">Profile & Strategy</option>
                        </select>
                        <button type="button" onclick="window.addQuestion()" class="button button-primary">Add Question</button>
                    </div>
                </div>

                <div id="questionsContainer" class="space-y-4">
                    <!-- Questions will be added here -->
                </div>
            </div>
            
            <div class="flex justify-end space-x-4 pt-4 border-t">
                <button type="button" onclick="window.closeQuizBuilder()" class="button button-secondary">Cancel</button>
                <button type="submit" class="button button-primary">${isEditing ? 'Update Quiz' : 'Create Quiz'}</button>
            </div>
        </form>
    `;
    
    // Load existing questions if editing
    if (quiz && quiz.questions) {
        quiz.questions.forEach(question => {
            window.addQuestion(question);
        });
    }
    
    // Handle form submission
    const form = document.getElementById('quizBuilderForm');
    if (form) {
        form.addEventListener('submit', handleQuizSave);
    } else {
        console.error('Quiz builder form not found');
    }
    
    // Show the modal
    modal.classList.remove('hidden');
    console.log('Modal display classes:', modal.className);
}

window.addQuestion = function(existingQuestion = null) {
    const container = document.getElementById('questionsContainer');
    const questionType = existingQuestion?.type || document.getElementById('questionTypeSelect').value;
    const questionId = existingQuestion?.id || questionIdCounter++;
    
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-builder p-4 border border-gray-200 rounded-lg space-y-4';
    questionDiv.dataset.questionId = questionId;
    questionDiv.dataset.questionType = questionType;
    
    let questionHTML = `
        <div class="flex justify-between items-center">
            <h4 class="font-semibold text-gray-800">Question ${container.children.length + 1} (${questionType.replace('-', ' ')})</h4>
            <button type="button" onclick="removeQuestion(this)" class="text-red-600 hover:text-red-800">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
            </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Points</label>
                <input type="number" 
                       name="points_${questionId}" 
                       min="1" 
                       value="${existingQuestion?.points || 10}"
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                       required>
            </div>
            <div>
                <label class="flex items-center">
                    <input type="checkbox" 
                           name="requiresManualGrading_${questionId}" 
                           ${existingQuestion?.requiresManualGrading ? 'checked' : ''}
                           class="mr-2">
                    <span class="text-sm text-gray-700">Requires manual grading</span>
                </label>
            </div>
        </div>
        
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
            <textarea name="question_${questionId}" 
                      rows="3" 
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      required>${existingQuestion?.question || ''}</textarea>
        </div>
    `;
    
    // Add type-specific fields
    switch (questionType) {
        case 'multiple-choice':
            questionHTML += `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Options</label>
                    <div class="space-y-2">
                        ${(existingQuestion?.options || ['', '', '', '']).map((option, index) => `
                            <div class="flex items-center space-x-2">
                                <input type="radio" 
                                       name="correctAnswer_${questionId}" 
                                       value="${index}"
                                       ${existingQuestion?.correctAnswer === index ? 'checked' : ''}
                                       class="text-primary focus:ring-primary">
                                <input type="text" 
                                       name="option_${questionId}_${index}" 
                                       value="${option}"
                                       class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                       placeholder="Option ${index + 1}"
                                       required>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            break;
            
        case 'fill-blank':
            questionHTML += `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Correct Answer</label>
                    <input type="text" 
                           name="correctAnswer_${questionId}" 
                           value="${existingQuestion?.correctAnswer || ''}"
                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                           required>
                </div>
            `;
            break;
            
        case 'fill-blank-double':
            questionHTML += `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Correct Answers</label>
                    <div class="grid grid-cols-2 gap-4">
                        <input type="text" 
                               name="correctAnswer1_${questionId}" 
                               value="${existingQuestion?.correctAnswers?.[0] || ''}"
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                               placeholder="First answer"
                               required>
                        <input type="text" 
                               name="correctAnswer2_${questionId}" 
                               value="${existingQuestion?.correctAnswers?.[1] || ''}"
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                               placeholder="Second answer"
                               required>
                    </div>
                </div>
            `;
            break;
            
        case 'true-false':
            questionHTML += `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Correct Answer</label>
                    <div class="space-y-2">
                        <label class="flex items-center">
                            <input type="radio" 
                                   name="correctAnswer_${questionId}" 
                                   value="true"
                                   ${existingQuestion?.correctAnswer === true ? 'checked' : ''}
                                   class="mr-2 text-primary focus:ring-primary">
                            <span>True</span>
                        </label>
                        <label class="flex items-center">
                            <input type="radio" 
                                   name="correctAnswer_${questionId}" 
                                   value="false"
                                   ${existingQuestion?.correctAnswer === false ? 'checked' : ''}
                                   class="mr-2 text-primary focus:ring-primary">
                            <span>False</span>
                        </label>
                    </div>
                </div>
            `;
            break;

        case 'short-answer':
        case 'long-answer':
            questionHTML += `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Model Answer</label>
                    <textarea name="modelAnswer_${questionId}" 
                              rows="4" 
                              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder="Enter the model answer that will be shown to students after submission"
                              required>${existingQuestion?.modelAnswer || ''}</textarea>
                </div>
            `;
            break;

        case 'profile-strategy':
            questionHTML += `
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Model Profile 1</label>
                        <input type="text" 
                               name="modelProfile1_${questionId}" 
                               value="${existingQuestion?.modelAnswers?.profile1 || ''}"
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                               placeholder="e.g., The Learner"
                               required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Model Strategy 1</label>
                        <textarea name="modelStrategy1_${questionId}" 
                                  rows="3" 
                                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                  placeholder="Enter the model strategy for Profile 1"
                                  required>${existingQuestion?.modelAnswers?.strategy1 || ''}</textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Model Profile 2</label>
                        <input type="text" 
                               name="modelProfile2_${questionId}" 
                               value="${existingQuestion?.modelAnswers?.profile2 || ''}"
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                               placeholder="e.g., The Value Seeker"
                               required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Model Strategy 2</label>
                        <textarea name="modelStrategy2_${questionId}" 
                                  rows="3" 
                                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                  placeholder="Enter the model strategy for Profile 2"
                                  required>${existingQuestion?.modelAnswers?.strategy2 || ''}</textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Model Profile 3</label>
                        <input type="text" 
                               name="modelProfile3_${questionId}" 
                               value="${existingQuestion?.modelAnswers?.profile3 || ''}"
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                               placeholder="e.g., The Day Tripper"
                               required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Model Strategy 3</label>
                        <textarea name="modelStrategy3_${questionId}" 
                                  rows="3" 
                                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                  placeholder="Enter the model strategy for Profile 3"
                                  required>${existingQuestion?.modelAnswers?.strategy3 || ''}</textarea>
                    </div>
                </div>
            `;
            break;
    }
    
    questionDiv.innerHTML = questionHTML;
    container.appendChild(questionDiv);
};

window.removeQuestion = function(button) {
    button.closest('.question-builder').remove();
};

function updateQuestionNumbers() {
    const questions = document.querySelectorAll('.question-builder');
    questions.forEach((question, index) => {
        const header = question.querySelector('h4');
        if (header) {
            const type = question.dataset.questionType.replace('-', ' ');
            header.textContent = `Question ${index + 1} (${type})`;
        }
    });
}

async function handleQuizSave(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const chapterNumber = parseInt(formData.get('chapterNumber'));
    const title = formData.get('quizTitle');
    
    // Collect questions
    const questions = [];
    const questionElements = document.querySelectorAll('.question-builder');
    
    questionElements.forEach((questionEl, index) => {
        const questionId = questionEl.dataset.questionId;
        const questionType = questionEl.dataset.questionType;
        
        const question = {
            id: parseInt(questionId),
            type: questionType,
            question: formData.get(`question_${questionId}`),
            points: parseInt(formData.get(`points_${questionId}`)),
            requiresManualGrading: formData.get(`requiresManualGrading_${questionId}`) === 'on'
        };
        
        // Add type-specific data
        switch (questionType) {
            case 'multiple-choice':
                question.options = [
                    formData.get(`option_${questionId}_0`),
                    formData.get(`option_${questionId}_1`),
                    formData.get(`option_${questionId}_2`),
                    formData.get(`option_${questionId}_3`)
                ];
                question.correctAnswer = parseInt(formData.get(`correctAnswer_${questionId}`));
                break;
                
            case 'fill-blank':
                question.correctAnswer = formData.get(`correctAnswer_${questionId}`);
                break;
                
            case 'fill-blank-double':
                question.correctAnswers = [
                    formData.get(`correctAnswer1_${questionId}`),
                    formData.get(`correctAnswer2_${questionId}`)
                ];
                break;
                
            case 'true-false':
                question.correctAnswer = formData.get(`correctAnswer_${questionId}`) === 'true';
                break;

            case 'short-answer':
            case 'long-answer':
                question.modelAnswer = formData.get(`modelAnswer_${questionId}`);
                break;

            case 'profile-strategy':
                question.modelAnswers = {
                    profile1: formData.get(`modelProfile1_${questionId}`),
                    strategy1: formData.get(`modelStrategy1_${questionId}`),
                    profile2: formData.get(`modelProfile2_${questionId}`),
                    strategy2: formData.get(`modelStrategy2_${questionId}`),
                    profile3: formData.get(`modelProfile3_${questionId}`),
                    strategy3: formData.get(`modelStrategy3_${questionId}`)
                };
                break;
        }
        
        questions.push(question);
    });
    
    const quizData = {
        chapterNumber: chapterNumber,
        title: title,
        questions: questions,
        updatedAt: serverTimestamp()
    };
    
    try {
        if (currentQuizId) {
            // Update existing quiz
            await updateDoc(doc(db, 'quizzes', currentQuizId), quizData);
            alert('Quiz updated successfully!');
        } else {
            // Create new quiz
            quizData.createdAt = serverTimestamp();
            await addDoc(collection(db, 'quizzes'), quizData);
            alert('Quiz created successfully!');
        }
        
        closeQuizBuilder();
        loadQuizzes();
    } catch (error) {
        console.error('Error saving quiz:', error);
        alert('Error saving quiz. Please try again.');
    }
}

window.closeQuizBuilder = function() {
    document.getElementById('quizBuilderModal').classList.add('hidden');
    currentQuizId = null;
};

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
        const uniqueChapters = new Set(); // Track unique chapters
        
        querySnapshot.forEach((doc) => {
            console.log('Processing submission:', doc.data());
            const submission = {
                id: doc.id,
                ...doc.data()
            };
            submissions.push(submission);
            
            // Add chapter to unique chapters set
            if (submission.chapterTitle) {
                uniqueChapters.add(submission.chapterTitle);
            }
            
            if (submission.status === 'pending_review') {
                pendingCount++;
            } else {
                gradedCount++;
            }
        });
        
        // Update chapter filter options
        const chapterFilter = document.getElementById('chapterFilter');
        if (chapterFilter) {
            // Keep the "All Chapters" option
            chapterFilter.innerHTML = '<option value="all">All Chapters</option>';
            
            // Add unique chapters sorted by chapter number
            Array.from(uniqueChapters)
                .sort((a, b) => {
                    // Extract chapter numbers and compare
                    const numA = parseInt(a.match(/Chapter (\d+)/)?.[1] || '0');
                    const numB = parseInt(b.match(/Chapter (\d+)/)?.[1] || '0');
                    return numA - numB;
                })
                .forEach(chapter => {
                    const option = document.createElement('option');
                    option.value = chapter;
                    option.textContent = chapter;
                    chapterFilter.appendChild(option);
                });
        }
        
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
    const viewFilter = document.getElementById('viewFilter')?.value || 'pending';
    const chapterFilter = document.getElementById('chapterFilter')?.value || 'all';
    
    console.log('Filtering with:', { searchEmail, viewFilter, chapterFilter });
    
    // Filter submissions
    const filteredSubmissions = submissions.filter(submission => {
        const matchesEmail = submission.userEmail.toLowerCase().includes(searchEmail);
        const matchesView = viewFilter === 'pending' ? 
            submission.status === 'pending_review' : 
            submission.status === 'graded';
        const matchesChapter = chapterFilter === 'all' || submission.chapterTitle === chapterFilter;
        
        console.log('Submission:', {
            email: submission.userEmail,
            status: submission.status,
            chapter: submission.chapterTitle,
            matches: { matchesEmail, matchesView, matchesChapter }
        });
        
        return matchesEmail && matchesView && matchesChapter;
    });
    
    console.log('Filtered submissions:', filteredSubmissions.length);
    
    // Update stats
    document.getElementById('totalSubmissions').textContent = submissions.length;
    document.getElementById('pendingSubmissions').textContent = submissions.filter(s => s.status === 'pending_review').length;
    document.getElementById('gradedSubmissions').textContent = submissions.filter(s => s.status === 'graded').length;
    
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
    // View filter
    const viewFilter = document.getElementById('viewFilter');
    if (viewFilter) {
        viewFilter.addEventListener('change', () => {
            updateDashboardUI(); // Only update UI, don't reload data
        });
    }
    
    // Chapter filter
    const chapterFilter = document.getElementById('chapterFilter');
    if (chapterFilter) {
        chapterFilter.addEventListener('change', () => {
            updateDashboardUI(); // Only update UI, don't reload data
        });
    }
    
    // Search input
    const searchInput = document.getElementById('searchEmail');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            updateDashboardUI(); // Only update UI, don't reload data
        });
    }
});