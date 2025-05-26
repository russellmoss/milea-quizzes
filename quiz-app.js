// Firebase imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    addDoc, 
    serverTimestamp,
    updateDoc,
    initializeFirestore,
    enableIndexedDbPersistence,
    CACHE_SIZE_UNLIMITED,
    query,
    orderBy,
    getDocs
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Replace dynamic import with static import
import { firebaseConfig } from './config.js';

// Initialize Firebase
let auth;
let db;

async function initializeFirebase() {
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        
        // Initialize Firestore with settings
        db = initializeFirestore(app, {
            cacheSizeBytes: CACHE_SIZE_UNLIMITED,
            ignoreUndefinedProperties: true
        });

        // Enable offline persistence
        try {
            await enableIndexedDbPersistence(db);
            console.log('Offline persistence enabled');
        } catch (error) {
            if (error.code === 'failed-precondition') {
                console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
            } else if (error.code === 'unimplemented') {
                console.warn('The current browser does not support persistence.');
            }
        }

        // Make Firebase available globally
        window.auth = auth;
        window.db = db;
        window.firebase = {
            signInWithEmailAndPassword,
            createUserWithEmailAndPassword,
            signOut,
            doc,
            getDoc,
            setDoc,
            collection,
            addDoc,
            serverTimestamp
        };

        // Auth state observer with better error handling
        onAuthStateChanged(auth, async (user) => {
            console.log('Auth state changed:', user ? 'User logged in' : 'No user');
            currentUser = user;
            
            if (user) {
                try {
                    await createOrUpdateUserProfile(user);
                    await loadQuizzesFromFirestore();
                } catch (error) {
                    console.error('Error handling user profile:', error);
                    // Don't throw here, just log the error
                    // This allows the app to continue working even if profile creation fails
                }
            }
            
            updateUIForAuthState(user);
        });

        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        // Show user-friendly error message
        alert('Error connecting to the server. Please check your internet connection and try again.');
    }
}

// Initialize Firebase when the page loads
initializeFirebase();

// Global variables
let currentUser = null;
let currentQuiz = null;
let userAnswers = {};
let availableQuizzes = {}; // Store loaded quizzes

// Handle login form submission
document.getElementById('authFormLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
});

// Handle signup form submission
document.getElementById('authFormSignup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await createOrUpdateUserProfile(userCredential.user, { name });
    } catch (error) {
        alert('Signup failed: ' + error.message);
    }
});

// Toggle between login and signup forms
window.toggleAuthMode = function() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    
    if (loginForm.classList.contains('hidden')) {
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    } else {
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
    }
};

// Load quizzes from Firestore
async function loadQuizzesFromFirestore() {
    try {
        console.log('Loading quizzes from Firestore...');
        const quizzesRef = collection(db, 'quizzes');
        const q = query(quizzesRef, orderBy('chapterNumber'));
        const querySnapshot = await getDocs(q);
        
        console.log('Query snapshot size:', querySnapshot.size);
        
        availableQuizzes = {};
        querySnapshot.forEach((doc) => {
            const quiz = doc.data();
            console.log('Processing quiz:', doc.id, quiz);
            availableQuizzes[quiz.chapterNumber] = {
                id: doc.id,
                ...quiz
            };
        });
        
        console.log('Available quizzes after loading:', availableQuizzes);
        updateQuizSelectionUI();
    } catch (error) {
        console.error('Error loading quizzes:', error);
        console.error('Error details:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        showQuizLoadError();
    }
}

function updateQuizSelectionUI() {
    const quizSelectionDiv = document.getElementById('quizSelection');
    if (!quizSelectionDiv) {
        console.error('Quiz selection div not found');
        return;
    }
    
    const gridDiv = quizSelectionDiv.querySelector('.grid');
    if (!gridDiv) {
        console.error('Grid div not found');
        return;
    }
    
    console.log('Updating quiz selection UI with quizzes:', availableQuizzes);
    
    // Clear existing quiz cards
    gridDiv.innerHTML = '';
    
    if (Object.keys(availableQuizzes).length === 0) {
        console.log('No quizzes available');
        gridDiv.innerHTML = `
            <div class="col-span-full text-center py-8">
                <p class="text-gray-600">No quizzes available at the moment.</p>
                <p class="text-sm text-gray-500 mt-2">Please check back later or contact your administrator.</p>
            </div>
        `;
        return;
    }
    
    // Sort by chapter number and create cards
    Object.keys(availableQuizzes)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .forEach(chapterNumber => {
            const quiz = availableQuizzes[chapterNumber];
            console.log('Creating card for quiz:', quiz);
            
            const quizCard = document.createElement('div');
            quizCard.className = 'bg-white rounded-lg shadow-md p-6 border-l-4 border-primary';
            quizCard.innerHTML = `
                <h3 class="text-lg font-semibold mb-2">Chapter ${quiz.chapterNumber}</h3>
                <p class="text-gray-600 mb-4">${quiz.title}</p>
                <p class="text-sm text-gray-500 mb-4">${quiz.questions?.length || 0} questions</p>
                <button onclick="window.startQuiz(${quiz.chapterNumber})" class="button button-primary w-full">Start Quiz</button>
            `;
            
            gridDiv.appendChild(quizCard);
        });
}

function showQuizLoadError() {
    const quizSelectionDiv = document.getElementById('quizSelection');
    if (!quizSelectionDiv) return;
    
    const gridDiv = quizSelectionDiv.querySelector('.grid');
    if (!gridDiv) return;
    
    gridDiv.innerHTML = `
        <div class="col-span-full text-center py-8">
            <p class="text-red-600 mb-2">Error loading quizzes</p>
            <p class="text-sm text-gray-500 mb-4">There was a problem loading the available quizzes.</p>
            <button onclick="loadQuizzesFromFirestore()" class="button button-primary">Try Again</button>
        </div>
    `;
}

// Quiz functions
function startQuiz(chapterNumber) {
    const quiz = availableQuizzes[chapterNumber];
    if (!quiz) {
        alert('Quiz not found. Please try refreshing the page.');
        return;
    }
    
    currentQuiz = quiz;
    userAnswers = {};
    
    document.getElementById('quizSelection').classList.add('hidden');
    document.getElementById('quizInterface').classList.remove('hidden');
    document.getElementById('quizResults').classList.add('hidden');
    
    // Set the quiz title
    document.getElementById('quizTitle').textContent = currentQuiz.title;
    
    loadQuestions();
}

function loadQuestions() {
    const container = document.getElementById('questionsContainer');
    container.innerHTML = '';
    
    currentQuiz.questions.forEach((question, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'mb-8 p-6 border border-gray-200 rounded-lg';
        
        let questionHTML = `
            <h3 class="text-lg font-semibold mb-4 text-gray-800">
                Question ${index + 1} (${question.points} points)
            </h3>
            <p class="mb-4 text-gray-700">${question.question}</p>
        `;
        
        switch (question.type) {
            case 'fill-blank':
                questionHTML += `
                    <input type="text" 
                           name="question_${question.id}" 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                           placeholder="Your answer">
                `;
                break;
                
            case 'fill-blank-double':
                questionHTML += `
                    <div class="flex gap-4">
                        <input type="text" 
                               name="question_${question.id}_1" 
                               class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                               placeholder="First answer">
                        <span class="self-center">to</span>
                        <input type="text" 
                               name="question_${question.id}_2" 
                               class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                               placeholder="Second answer">
                    </div>
                `;
                break;
                
            case 'multiple-choice':
                question.options.forEach((option, optionIndex) => {
                    questionHTML += `
                        <label class="flex items-center mb-2 cursor-pointer">
                            <input type="radio" 
                                   name="question_${question.id}" 
                                   value="${optionIndex}"
                                   class="mr-3 text-primary focus:ring-primary">
                            <span class="text-gray-700">${String.fromCharCode(65 + optionIndex)}) ${option}</span>
                        </label>
                    `;
                });
                break;
                
            case 'true-false':
                questionHTML += `
                    <label class="flex items-center mb-2 cursor-pointer">
                        <input type="radio" 
                               name="question_${question.id}" 
                               value="true"
                               class="mr-3 text-primary focus:ring-primary">
                        <span class="text-gray-700">True</span>
                    </label>
                    <label class="flex items-center mb-2 cursor-pointer">
                        <input type="radio" 
                               name="question_${question.id}" 
                               value="false"
                               class="mr-3 text-primary focus:ring-primary">
                        <span class="text-gray-700">False</span>
                    </label>
                `;
                break;
                
            case 'short-answer':
                questionHTML += `
                    <textarea name="question_${question.id}" 
                              rows="4" 
                              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder="Your detailed answer here..."></textarea>
                `;
                break;
                
            case 'long-answer':
                questionHTML += `
                    <textarea name="question_${question.id}" 
                              rows="6" 
                              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder="Provide a detailed answer in your own words..."></textarea>
                `;
                break;
                
            case 'profile-strategy':
                questionHTML += `
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Profile 1:</label>
                            <input type="text" 
                                   name="question_${question.id}_profile1" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                   placeholder="e.g., The Learner, The Value Seeker, etc.">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Milea Strategy for Profile 1:</label>
                            <textarea name="question_${question.id}_strategy1" 
                                      rows="3" 
                                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                      placeholder="Describe the specific Milea strategy for this profile..."></textarea>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Profile 2:</label>
                            <input type="text" 
                                   name="question_${question.id}_profile2" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                   placeholder="e.g., The Rating Hound, The Day Tripper, etc.">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Milea Strategy for Profile 2:</label>
                            <textarea name="question_${question.id}_strategy2" 
                                      rows="3" 
                                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                      placeholder="Describe the specific Milea strategy for this profile..."></textarea>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Profile 3:</label>
                            <input type="text" 
                                   name="question_${question.id}_profile3" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                   placeholder="e.g., The Diner, The Trade Member, etc.">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Milea Strategy for Profile 3:</label>
                            <textarea name="question_${question.id}_strategy3" 
                                      rows="3" 
                                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                      placeholder="Describe the specific Milea strategy for this profile..."></textarea>
                        </div>
                    </div>
                `;
                break;
        }
        
        questionDiv.innerHTML = questionHTML;
        container.appendChild(questionDiv);
    });
    
    updateProgressBar();
}

function updateProgressBar() {
    // Simple progress based on questions answered
    const totalQuestions = currentQuiz.questions.length;
    const answeredQuestions = Object.keys(userAnswers).length;
    const progress = (answeredQuestions / totalQuestions) * 100;
    document.getElementById('progressBar').style.width = progress + '%';
}

// Handle quiz submission
document.getElementById('quizForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Collect all answers
    const formData = new FormData(e.target);
    userAnswers = {};
    
    currentQuiz.questions.forEach(question => {
        switch (question.type) {
            case 'fill-blank':
            case 'multiple-choice':
            case 'true-false':
            case 'short-answer':
            case 'long-answer':
                userAnswers[question.id] = formData.get(`question_${question.id}`);
                break;
            case 'fill-blank-double':
                userAnswers[question.id] = [
                    formData.get(`question_${question.id}_1`),
                    formData.get(`question_${question.id}_2`)
                ];
                break;
            case 'profile-strategy':
                userAnswers[question.id] = {
                    profile1: formData.get(`question_${question.id}_profile1`),
                    strategy1: formData.get(`question_${question.id}_strategy1`),
                    profile2: formData.get(`question_${question.id}_profile2`),
                    strategy2: formData.get(`question_${question.id}_strategy2`),
                    profile3: formData.get(`question_${question.id}_profile3`),
                    strategy3: formData.get(`question_${question.id}_strategy3`)
                };
                break;
        }
    });
    
    // Grade the quiz
    const results = gradeQuiz();
    
    // Save to Firebase
    await saveQuizResults(results);
});

function gradeQuiz() {
    let totalPoints = 0;
    let maxPoints = 0;
    const questionResults = [];
    
    currentQuiz.questions.forEach(question => {
        maxPoints += question.points;
        const userAnswer = userAnswers[question.id];
        let isCorrect = false;
        let points = 0;
        let needsManualGrading = false;
        
        if (question.requiresManualGrading) {
            needsManualGrading = true;
            points = 0; // Points will be assigned by admin
        } else {
            switch (question.type) {
                case 'fill-blank':
                    isCorrect = userAnswer?.toLowerCase().trim() === question.correctAnswer.toLowerCase();
                    points = isCorrect ? question.points : 0;
                    break;
                    
                case 'multiple-choice':
                    isCorrect = parseInt(userAnswer) === question.correctAnswer;
                    points = isCorrect ? question.points : 0;
                    break;
                    
                case 'true-false':
                    isCorrect = userAnswer === question.correctAnswer.toString();
                    points = isCorrect ? question.points : 0;
                    break;
                    
                case 'fill-blank-double':
                    const [answer1, answer2] = userAnswer || [];
                    isCorrect = answer1?.toLowerCase().trim() === question.correctAnswers[0].toLowerCase() &&
                               answer2?.toLowerCase().trim() === question.correctAnswers[1].toLowerCase();
                    points = isCorrect ? question.points : 0;
                    break;
                    
                case 'short-answer':
                case 'long-answer':
                case 'profile-strategy':
                    // These always require manual grading
                    needsManualGrading = true;
                    points = 0;
                    break;
            }
        }
        
        totalPoints += points;
        
        questionResults.push({
            id: question.id,
            question: question.question,
            userAnswer: userAnswer,
            correctAnswer: question.correctAnswer || question.correctAnswers,
            isCorrect: isCorrect,
            points: points,
            maxPoints: question.points,
            explanation: question.explanation,
            needsManualGrading: needsManualGrading
        });
    });
    
    return {
        score: totalPoints,
        maxScore: maxPoints,
        percentage: Math.round((totalPoints / maxPoints) * 100),
        questionResults: questionResults
    };
}

// Function to create or update user profile
async function createOrUpdateUserProfile(user, additionalData = {}) {
    try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
            // Create new user profile
            await setDoc(userRef, {
                name: user.displayName || user.email,
                email: user.email,
                createdAt: serverTimestamp(),
                ...additionalData
            });
        } else {
            // Update existing user profile
            await updateDoc(userRef, {
                name: user.displayName || user.email,
                email: user.email,
                updatedAt: serverTimestamp(),
                ...additionalData
            });
        }
    } catch (error) {
        console.error('Error creating/updating user profile:', error);
        throw error;
    }
}

async function saveQuizResults(results) {
    try {
        console.log('Saving quiz results...');
        
        // Get current user
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User must be logged in to submit quiz results');
        }

        // Get user data
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
            // Create user profile if it doesn't exist
            await createOrUpdateUserProfile(user);
        }
        
        const userData = userDoc.data();
        console.log('User data:', userData);

        // Validate currentQuiz data
        if (!currentQuiz) {
            throw new Error('No quiz data available');
        }

        // Validate results data
        if (!results || !results.questionResults) {
            throw new Error('Invalid quiz results data');
        }

        // Prepare submission data with validation
        const submissionData = {
            userId: user.uid || '',
            userName: (userData?.name || user.email || ''),
            userEmail: user.email || '',
            chapterNumber: currentQuiz.chapterNumber || 0,
            chapterTitle: currentQuiz.title || '',
            score: results.score || 0,
            maxScore: results.maxScore || 0,
            percentage: results.percentage || 0,
            questionResults: results.questionResults.map(result => ({
                id: result.id || '',
                question: result.question || '',
                userAnswer: result.userAnswer || '',
                correctAnswer: result.correctAnswer || '',
                isCorrect: result.isCorrect || false,
                points: result.points || 0,
                maxPoints: result.maxPoints || 0,
                explanation: result.explanation || '',
                needsManualGrading: result.needsManualGrading || false
            })),
            submittedAt: serverTimestamp(),
            status: 'pending_review'
        };

        // Log the submission data for debugging
        console.log('Submitting quiz results:', JSON.stringify(submissionData, null, 2));

        // Add submission to Firestore
        const submissionRef = await addDoc(collection(db, 'quiz_submissions'), submissionData);
        console.log('Quiz results saved successfully with ID:', submissionRef.id);

        // Show success message
        showResults(results);
    } catch (error) {
        console.error('Error saving quiz results:', error);
        console.error('Error details:', error);
        
        // Show user-friendly error message
        const errorMessage = error.code === 'permission-denied' 
            ? 'Unable to submit quiz. Please ensure you are logged in and try again.'
            : 'An error occurred while saving your quiz results. Please try again.';
            
        alert(errorMessage);
    }
}

function formatUserAnswer(result) {
    if (typeof result.userAnswer === 'object' && result.userAnswer !== null) {
        if (Array.isArray(result.userAnswer)) {
            return result.userAnswer.join(' to ');
        } else if (result.userAnswer.profile1) {
            // Profile-strategy format
            return `
                <div class="space-y-2 text-sm">
                    <div><strong>Profile 1:</strong> ${result.userAnswer.profile1 || 'Not provided'}</div>
                    <div><strong>Strategy 1:</strong> ${result.userAnswer.strategy1 || 'Not provided'}</div>
                    <div><strong>Profile 2:</strong> ${result.userAnswer.profile2 || 'Not provided'}</div>
                    <div><strong>Strategy 2:</strong> ${result.userAnswer.strategy2 || 'Not provided'}</div>
                    <div><strong>Profile 3:</strong> ${result.userAnswer.profile3 || 'Not provided'}</div>
                    <div><strong>Strategy 3:</strong> ${result.userAnswer.strategy3 || 'Not provided'}</div>
                </div>
            `;
        }
    }
    return result.userAnswer || 'No answer provided';
}

function showResults(results) {
    document.getElementById('quizInterface').classList.add('hidden');
    document.getElementById('quizResults').classList.remove('hidden');
    
    document.getElementById('scoreDisplay').textContent = `${results.percentage}%`;
    document.getElementById('scoreText').textContent = 
        results.questionResults.some(q => q.needsManualGrading) 
            ? 'Your quiz has been submitted and is pending review by an administrator.'
            : 'Quiz completed!';
    
    const reviewContainer = document.getElementById('answersReview');
    reviewContainer.innerHTML = '';
    
    results.questionResults.forEach((result, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'p-4 border border-gray-200 rounded-lg';
        
        let statusClass = result.needsManualGrading ? 'text-yellow-600' :
                         result.isCorrect ? 'text-green-600' : 'text-red-600';
        
        let statusText = result.needsManualGrading ? 'Pending Review' :
                        result.isCorrect ? 'Correct' : 'Incorrect';
        
        // Get the current question from the quiz to access model answers
        const currentQuestion = currentQuiz.questions.find(q => q.id === result.id);
        
        questionDiv.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h4 class="text-lg font-semibold">Question ${index + 1}</h4>
                <span class="${statusClass}">${statusText}</span>
            </div>
            <p class="text-gray-700 mb-2">${result.question}</p>
            <div class="mb-2">
                <strong>Your Answer:</strong>
                <div class="text-gray-600 mt-1">${formatUserAnswer(result)}</div>
            </div>
            <div class="mb-2">
                <strong>Model Answer:</strong>
                <div class="text-gray-600 mt-1 whitespace-pre-line">${formatModelAnswer(currentQuestion, result)}</div>
            </div>
            ${result.explanation ? `<p class="text-sm text-gray-500 mb-2">${result.explanation}</p>` : ''}
            <div class="mt-2">
                <strong>Points:</strong>
                <span class="${statusClass}">${result.points}/${result.maxPoints}</span>
            </div>
        `;
        
        reviewContainer.appendChild(questionDiv);
    });
}

function formatModelAnswer(question, result) {
    if (!question) return 'No model answer available';
    
    switch (question.type) {
        case 'short-answer':
        case 'long-answer':
            return question.modelAnswer || 'No model answer available';
            
        case 'profile-strategy':
            if (!question.modelAnswers) return 'No model answer available';
            return `
                Profile 1: ${question.modelAnswers.profile1 || 'Not provided'}
                Strategy 1: ${question.modelAnswers.strategy1 || 'Not provided'}
                
                Profile 2: ${question.modelAnswers.profile2 || 'Not provided'}
                Strategy 2: ${question.modelAnswers.strategy2 || 'Not provided'}
                
                Profile 3: ${question.modelAnswers.profile3 || 'Not provided'}
                Strategy 3: ${question.modelAnswers.strategy3 || 'Not provided'}
            `;
            
        case 'fill-blank':
            return question.correctAnswer || 'No model answer available';
            
        case 'fill-blank-double':
            return question.correctAnswers ? question.correctAnswers.join(' to ') : 'No model answer available';
            
        case 'multiple-choice':
            return question.options ? question.options[question.correctAnswer] : 'No model answer available';
            
        case 'true-false':
            return question.correctAnswer ? 'True' : 'False';
            
        default:
            return 'No model answer available';
    }
}

function goBackToSelection() {
    document.getElementById('quizInterface').classList.add('hidden');
    document.getElementById('quizResults').classList.add('hidden');
    document.getElementById('quizSelection').classList.remove('hidden');
}

function retakeQuiz() {
    if (currentQuiz) {
        startQuiz(1); // Restart current quiz
    }
}

function updateUIForAuthState(user) {
    const authModal = document.getElementById('authModal');
    const mainApp = document.getElementById('mainApp');
    const quizSelection = document.getElementById('quizSelection');
    const userNameElement = document.getElementById('userName');

    if (user) {
        // User is signed in
        authModal.classList.add('hidden');
        mainApp.classList.remove('hidden');
        quizSelection.classList.remove('hidden');
        
        // Update user name display
        if (userNameElement) {
            userNameElement.textContent = user.displayName || user.email;
        }
    } else {
        // User is signed out
        authModal.classList.remove('hidden');
        mainApp.classList.add('hidden');
        quizSelection.classList.add('hidden');
    }
}

// Make functions available globally
window.startQuiz = function(chapterNumber) {
    startQuiz(chapterNumber);
};

window.goBackToSelection = function() {
    goBackToSelection();
};

window.retakeQuiz = function() {
    retakeQuiz();
};

window.logout = function() {
    signOut(auth);
};

window.toggleAuthMode = function() {
    toggleAuthMode();
};

window.loadQuizzesFromFirestore = function() {
    loadQuizzesFromFirestore();
};

// iframe height management
if (window.parent !== window) {
    function sendHeight() {
        const height = Math.max(document.body.scrollHeight, 800);
        window.parent.postMessage({ type: 'resize', height }, '*');
    }
    setInterval(sendHeight, 1000);
    window.addEventListener('load', sendHeight);
}