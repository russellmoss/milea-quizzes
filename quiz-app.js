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
    CACHE_SIZE_UNLIMITED
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

// Quiz Data
const quizData = {
    1: {
        chapterNumber: 1,
        title: "Chapter 1: First Impressions Core Concepts",
        questions: [
            {
                id: 1,
                type: "fill-blank",
                question: "Your manual emphasizes that guests not acknowledged within the first _______ seconds tend to rate their experience lower.",
                correctAnswer: "15",
                points: 10
            },
            {
                id: 2,
                type: "multiple-choice",
                question: "What is a primary hospitality objective of clear and professional signage for guest arrival, according to your training?",
                options: [
                    "To showcase Milea's marketing budget.",
                    "To reduce guest confusion or anxiety, creating a sense of ease.",
                    "To provide detailed historical information about the vineyard.",
                    "To list all the wines available for tasting."
                ],
                correctAnswer: 1, // Index of correct answer (B)
                explanation: "As your manual states under 'Guest Arrival: The Importance of Clear Signage,' the hospitality objective is to 'Reduces guest confusion or anxiety, creating a sense of ease and confidence from the outset.'",
                points: 15
            },
            {
                id: 3,
                type: "short-answer",
                question: "Your manual suggests 'Asking Key Initial Questions.' List two such questions a Tasting Associate should consider asking guests after welcoming them to their table.",
                correctAnswers: [
                    "Welcome! Is this your first time visiting Milea Estate, or have you been here before?",
                    "What kinds of wines do you typically enjoy?",
                    "Are there any particular styles you're drawn to -- perhaps bold reds, crisp whites, or something a bit sweeter?",
                    "How did you hear about Milea Estate Vineyard today?",
                    "Are you celebrating a special occasion today, or just out enjoying a beautiful day of wine tasting?"
                ],
                points: 20,
                requiresManualGrading: true
            },
            {
                id: 4,
                type: "true-false",
                question: "Using a guest's name, when known, 'makes guests feel recognized, important, and like individuals rather than just another transaction,' as stated in your manual.",
                correctAnswer: true,
                explanation: "As stated in your manual under 'Personalization Power: Using Guest Names,' using a name 'Makes guests feel recognized, important, and like individuals rather than just another transaction.'",
                points: 10
            },
            {
                id: 5,
                type: "fill-blank-double",
                question: "When sharing the Milea brand story, your manual advises keeping it brief at the initial stage, aiming for an introduction of about _____ to _____ minutes.",
                correctAnswers: ["1", "2"],
                explanation: "As stated in your manual under 'Concise and Compelling: Sharing the Milea Brand Story,' 'Keep it Brief: 1-2 minutes is usually sufficient at this stage.'",
                points: 15,
                requiresManualGrading: true
            },
            {
                id: 6,
                type: "short-answer",
                question: "Briefly describe one key element of the Milea brand story that you could share with a first-time guest, drawing from the 'Concise and Compelling: Sharing the Milea Brand Story' section of your manual or the 'About Us' information.",
                correctAnswers: [
                    "Milea Estate is a family endeavor, rooted in over a century of farming right here in the Hudson River Valley",
                    "Our passion is to really showcase what this incredible region can produce, especially with varietals like Chardonnay and Cabernet Franc, which we believe can be world-class here"
                ],
                points: 30,
                requiresManualGrading: true
            }
        ]
    },
    2: {
        chapterNumber: 2,
        title: "Chapter 2: Rapport & Needs Fundamentals",
        questions: [
            {
                id: 7,
                type: "long-answer",
                question: "Explain the philosophy of \"helpful sales\" at Milea Estate Vineyard in your own words.",
                correctAnswer: "Answer should reflect the manual's sentiment: It's about reframing sales not as pressure or manipulation, but as sharing something wonderful (our wines, our club) to enhance someone's life and enjoyment. It's driven by a genuine belief in the product and a desire to help guests find what will bring them pleasure, thereby building lasting trust.",
                points: 25,
                requiresManualGrading: true
            },
            {
                id: 8,
                type: "long-answer",
                question: "What is the difference between positive profiling and negative profiling, as described in your manual?",
                correctAnswer: "Answer should align with the manual: Positive profiling uses observation and empathy (behavior, questions, cues) to enhance the guest's experience by matching your style to their needs. Negative profiling uses assumptions and biases (skin color, age, clothing alone) to judge or limit someone, leading to missed opportunities and discrimination.",
                points: 25,
                requiresManualGrading: true
            },
            {
                id: 9,
                type: "long-answer",
                question: "Why are open-ended questions generally more effective than closed-ended questions when trying to build rapport and understand guest needs?",
                correctAnswer: "Answer should highlight points from the manual: Open-ended questions encourage guests to talk more, share detailed thoughts and feelings, which builds trust and satisfaction. They provide richer, more nuanced information, allowing for better tailoring of the experience and demonstrating genuine interest beyond just a sale.",
                points: 25,
                requiresManualGrading: true
            },
            {
                id: 10,
                type: "profile-strategy",
                question: "List three common tasting room guest profiles identified in your manual and briefly describe one Milea-specific strategy for interacting effectively with each.",
                subQuestions: [
                    "Profile 1:",
                    "Milea Strategy for Profile 1:",
                    "Profile 2:",
                    "Milea Strategy for Profile 2:",
                    "Profile 3:",
                    "Milea Strategy for Profile 3:"
                ],
                correctAnswer: "Answers will vary based on the three profiles chosen but should accurately reflect the descriptions and Milea approaches outlined in Chapter 2. Examples include:\n\nThe Value Seeker: Guide them to discover value, position wine value after they express liking, introduce club based on value proposition.\n\nThe Rating Hound: Build authority early by mentioning high scores, frame wines with accolades, offer score cards.\n\nThe Learner: Meet curiosity with enthusiasm, structure tasting around themes, encourage questions.\n\nThe Day Tripper: Be fun and friendly, simplify descriptions, use playful analogies, make it Instagrammable.\n\nThe Diner: Ask if first visit, recommend wine based on food choices, mention bottle purchase discount.\n\nThe Trade Member: Ask if in industry early, provide technical tasting, showcase flagships and hidden gems.",
                points: 25,
                requiresManualGrading: true
            }
        ]
    }
};

let currentUser = null;
let currentQuiz = null;
let userAnswers = {};

// Authentication functions
function toggleAuthMode() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    
    if (loginForm.classList.contains('hidden')) {
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    } else {
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
    }
}

// Handle login form
document.getElementById('authFormLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        await window.firebase.signInWithEmailAndPassword(window.auth, email, password);
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
});

// Handle signup form
document.getElementById('authFormSignup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
    try {
        const userCredential = await window.firebase.createUserWithEmailAndPassword(window.auth, email, password);
        const user = userCredential.user;
        
        // Create user profile
        await createOrUpdateUserProfile(user, {
            name: name,
            isAdmin: false // Default to non-admin
        });
        
    } catch (error) {
        alert('Signup failed: ' + error.message);
    }
});

function logout() {
    window.firebase.signOut(window.auth);
}

// Quiz functions
function startQuiz(chapterNumber) {
    currentQuiz = quizData[chapterNumber];
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
                <div class="text-gray-600 mt-1 whitespace-pre-line">${Array.isArray(result.correctAnswer) ? result.correctAnswer.join(' to ') : result.correctAnswer}</div>
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
    currentQuiz = quizData[chapterNumber];
    userAnswers = {};
    
    document.getElementById('quizSelection').classList.add('hidden');
    document.getElementById('quizInterface').classList.remove('hidden');
    document.getElementById('quizResults').classList.add('hidden');
    
    // Set the quiz title
    document.getElementById('quizTitle').textContent = currentQuiz.title;
    
    loadQuestions();
};

window.goBackToSelection = function() {
    document.getElementById('quizInterface').classList.add('hidden');
    document.getElementById('quizResults').classList.add('hidden');
    document.getElementById('quizSelection').classList.remove('hidden');
};

window.retakeQuiz = function() {
    if (currentQuiz) {
        startQuiz(currentQuiz.chapterNumber);
    }
};

window.logout = function() {
    signOut(auth);
};

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

// Update event listeners to use addEventListener instead of onclick
document.addEventListener('DOMContentLoaded', function() {
    // Login form
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

    // Signup form
    document.getElementById('authFormSignup').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Create user profile
            await createOrUpdateUserProfile(user, {
                name: name,
                isAdmin: false // Default to non-admin
            });
            
        } catch (error) {
            alert('Signup failed: ' + error.message);
        }
    });
});

// iframe height management
if (window.parent !== window) {
    function sendHeight() {
        const height = Math.max(document.body.scrollHeight, 800);
        window.parent.postMessage({ type: 'resize', height }, '*');
    }
    setInterval(sendHeight, 1000);
    window.addEventListener('load', sendHeight);
}