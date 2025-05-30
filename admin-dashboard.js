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
let courses = []; // Store courses globally
let currentSubmission = null; // Store current submission being viewed/graded
let currentQuizId = null; // Store current quiz being edited
let currentCourseId = null; // Store current course being managed
let questionIdCounter = 1; // For generating unique question IDs
let currentQuestionType = null;

// Auth state observer
onAuthStateChanged(auth, async (user) => {
    console.log('Auth state changed:', user ? 'User logged in' : 'No user');
    currentUser = user;
    if (user) {
        // Check if user is admin
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        console.log('User doc exists:', userDoc.exists());
        console.log('User is admin:', userDoc.exists() && userDoc.data().isAdmin);
        
        if (userDoc.exists() && userDoc.data().isAdmin) {
            document.getElementById('authModal').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            
            // Load all data
            await loadCourses(); // Load courses first
            await loadDashboardData();
            await loadQuizzes();
        } else {
            console.log('User is not an admin');
            alert('You do not have admin access.');
            signOut(auth);
        }
    } else {
        console.log('No user, showing auth modal');
        document.getElementById('authModal').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }
});

// Tab switching functionality
window.switchTab = function(tabName) {
    console.log('Switching to tab:', tabName);
    
    // Show/hide sections
    const sections = {
        submissions: document.getElementById('submissionsSection'),
        quizzes: document.getElementById('quizzesSection'),
        courses: document.getElementById('coursesSection')
    };
    
    // Update visibility
    Object.entries(sections).forEach(([name, section]) => {
        if (section) {
            section.style.display = name === tabName ? 'block' : 'none';
        }
    });
    
    // Update button styles
    const buttons = document.querySelectorAll('.flex.space-x-4.mb-6 button');
    buttons.forEach(button => {
        if (button.textContent.toLowerCase().includes(tabName)) {
            button.classList.remove('bg-gray-200', 'text-gray-700');
            button.classList.add('bg-blue-600', 'text-white');
        } else {
            button.classList.remove('bg-blue-600', 'text-white');
            button.classList.add('bg-gray-200', 'text-gray-700');
        }
    });
    
    // Load data for the selected tab
    if (tabName === 'submissions') {
        loadDashboardData();
    } else if (tabName === 'quizzes') {
        loadQuizzes();
    } else if (tabName === 'courses') {
        loadCourses();
    }
};

// Load courses from Firestore
async function loadCourses() {
    try {
        console.log('Loading courses...');
        const coursesRef = collection(db, 'courses');
        const q = query(coursesRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        courses = [];
        querySnapshot.forEach((doc) => {
            const course = {
                id: doc.id,
                ...doc.data()
            };
            courses.push(course);
        });
        
        console.log('Loaded courses:', courses.length);
        updateCoursesUI();
    } catch (error) {
        console.error('Error loading courses:', error);
        alert('Error loading courses. Please try again.');
    }
}

function updateCoursesUI() {
    const coursesList = document.getElementById('coursesList');
    if (!coursesList) return;
    
    coursesList.innerHTML = courses.map(course => `
        <div class="course-item p-4 border border-gray-200 rounded-lg mb-4">
            <div class="flex justify-between items-center">
                <div>
                    <h3 class="text-lg font-semibold">${course.name}</h3>
                    <p class="text-sm text-gray-600">${course.description}</p>
                    <p class="text-xs text-gray-500">Created: ${course.createdAt?.toDate().toLocaleDateString()}</p>
                </div>
                <div class="flex space-x-2">
                    <button onclick="editCourse('${course.id}')" class="button button-secondary">Edit</button>
                    <button onclick="toggleCourseStatus('${course.id}', ${!course.isActive})" 
                            class="button ${course.isActive ? 'button-danger' : 'button-success'}">
                        ${course.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onclick="deleteCourse('${course.id}')" 
                            class="button button-danger">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Course management functions
window.createNewCourse = function() {
    console.log('Creating new course...');
    currentCourseId = null;
    showCourseBuilder();
};

window.editCourse = function(courseId) {
    console.log('Editing course:', courseId);
    const course = courses.find(c => c.id === courseId);
    if (!course) {
        alert('Course not found');
        return;
    }
    
    currentCourseId = courseId;
    showCourseBuilder(course);
};

window.toggleCourseStatus = async function(courseId, newStatus) {
    try {
        await updateDoc(doc(db, 'courses', courseId), {
            isActive: newStatus
        });
        alert(`Course ${newStatus ? 'activated' : 'deactivated'} successfully!`);
        loadCourses();
    } catch (error) {
        console.error('Error updating course status:', error);
        alert('Error updating course status. Please try again.');
    }
};

window.deleteCourse = async function(courseId) {
    const course = courses.find(c => c.id === courseId);
    if (!course) {
        alert('Course not found');
        return;
    }
    
    if (confirm(`Are you sure you want to delete "${course.name}"? This will also delete all quizzes associated with this course. This action cannot be undone.`)) {
        try {
            // First, delete all quizzes associated with this course
            const quizzesRef = collection(db, 'quizzes');
            const q = query(quizzesRef, where('courseId', '==', courseId));
            const querySnapshot = await getDocs(q);
            
            // Delete each quiz
            const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
            
            // Then delete the course
            await deleteDoc(doc(db, 'courses', courseId));
            
            alert('Course and associated quizzes deleted successfully!');
            loadCourses(); // Reload the courses list
        } catch (error) {
            console.error('Error deleting course:', error);
            alert('Error deleting course. Please try again.');
        }
    }
};

function showCourseBuilder(course = null) {
    console.log('=== showCourseBuilder called ===');
    console.log('Course data:', course);
    
    // Get or create modal
    let modal = document.getElementById('courseBuilderModal');
    if (!modal) {
        console.log('Creating course builder modal...');
        modal = document.createElement('div');
        modal.id = 'courseBuilderModal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 hidden';
        modal.innerHTML = `
            <div class="fixed inset-0 flex items-center justify-center p-4">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                    <!-- Header -->
                    <div class="p-6 border-b">
                        <div class="flex justify-between items-center">
                            <h3 id="courseBuilderTitle" class="text-xl font-bold text-gray-900">${course ? 'Edit Course' : 'Create New Course'}</h3>
                            <button onclick="closeCourseBuilder()" class="text-gray-500 hover:text-gray-700">
                                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Content -->
                    <div class="p-6">
                        <form id="courseForm" class="space-y-4">
                            <div>
                                <label for="courseName" class="block text-sm font-medium text-gray-700">Course Title</label>
                                <input type="text" id="courseName" name="courseName" required
                                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                                    value="${course ? course.name : ''}">
                            </div>
                            <div>
                                <label for="courseDescription" class="block text-sm font-medium text-gray-700">Description</label>
                                <textarea id="courseDescription" name="courseDescription" rows="3"
                                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary">${course ? course.description : ''}</textarea>
                            </div>
                            <div class="flex justify-end space-x-2">
                                <button type="button" onclick="closeCourseBuilder()" class="button button-secondary">Cancel</button>
                                <button type="submit" class="button button-primary">Save Course</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        // Update existing modal content
        const title = modal.querySelector('#courseBuilderTitle');
        const nameInput = modal.querySelector('#courseName');
        const descriptionInput = modal.querySelector('#courseDescription');
        
        if (title) title.textContent = course ? 'Edit Course' : 'Create New Course';
        if (nameInput) nameInput.value = course ? course.name : '';
        if (descriptionInput) descriptionInput.value = course ? course.description : '';
    }

    // Show modal
    modal.classList.remove('hidden');

    // Add form submit handler
    const form = document.getElementById('courseForm');
    if (form) {
        form.addEventListener('submit', handleCourseSave);
    } else {
        console.error('Course form not found after modal creation');
    }
}

window.closeCourseBuilder = function() {
    const modal = document.getElementById('courseBuilderModal');
    if (!modal) {
        console.error('Course builder modal not found');
        return;
    }
    modal.classList.add('hidden');
    document.getElementById('courseForm').reset();
    currentCourseId = null;
};

async function handleCourseSave(e) {
    e.preventDefault();
    console.log('Handling course save...');
    
    const formData = new FormData(e.target);
    const courseData = {
        name: formData.get('courseName'),
        description: formData.get('courseDescription'),
        isActive: true,
        updatedAt: serverTimestamp()
    };
    
    console.log('Course data to save:', courseData);
    
    try {
        if (currentCourseId) {
            // Update existing course
            await updateDoc(doc(db, 'courses', currentCourseId), courseData);
            alert('Course updated successfully!');
        } else {
            // Create new course
            courseData.createdAt = serverTimestamp();
            const docRef = await addDoc(collection(db, 'courses'), courseData);
            console.log('New course created with ID:', docRef.id);
            alert('Course created successfully!');
        }
        
        closeCourseBuilder();
        await loadCourses(); // Reload courses to update the list
    } catch (error) {
        console.error('Error saving course:', error);
        alert('Error saving course. Please try again.');
    }
}

// Load quizzes from Firestore
async function loadQuizzes() {
    try {
        console.log('=== loadQuizzes called ===');
        console.log('Current db instance:', db);
        
        const quizzesRef = collection(db, 'quizzes');
        console.log('Quizzes collection reference created');
        
        const q = query(quizzesRef, orderBy('chapterNumber'));
        console.log('Query created with orderBy chapterNumber');
        
        console.log('Executing query...');
        const querySnapshot = await getDocs(q);
        console.log('Query executed, received snapshot with', querySnapshot.size, 'documents');
        
        quizzes = []; // Reset quizzes array
        const uniqueChapters = new Set();
        const uniqueCourses = new Set();
        
        querySnapshot.forEach((doc) => {
            console.log('Processing quiz document:', doc.id);
            const quiz = {
                id: doc.id,
                ...doc.data()
            };
            console.log('Quiz data:', quiz);
            quizzes.push(quiz);
            uniqueChapters.add(quiz.chapterNumber);
            if (quiz.courseName) {
                uniqueCourses.add(quiz.courseName);
            }
        });
        
        console.log('Loaded quizzes:', {
            total: quizzes.length,
            uniqueChapters: Array.from(uniqueChapters),
            uniqueCourses: Array.from(uniqueCourses)
        });
        
        // Update chapter filter options
        const chapterFilter = document.getElementById('chapterFilter');
        if (chapterFilter) {
            console.log('Updating chapter filter options');
            const options = Array.from(uniqueChapters)
                .sort((a, b) => a - b)
                .map(chapter => `<option value="${chapter}">Chapter ${chapter}</option>`);
            chapterFilter.innerHTML = `
                <option value="">All Chapters</option>
                ${options.join('')}
            `;
        } else {
            console.warn('Chapter filter element not found');
        }
        
        // Update course filter options
        const courseFilter = document.getElementById('quizCourseFilter');
        if (courseFilter) {
            console.log('Updating course filter options');
            const options = Array.from(uniqueCourses).map(course => 
                `<option value="${course}">${course}</option>`
            );
            courseFilter.innerHTML = `
                <option value="">All Courses</option>
                ${options.join('')}
            `;
        } else {
            console.warn('Course filter element not found');
        }
        
        updateQuizzesUI();
    } catch (error) {
        console.error('Error loading quizzes:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        alert('Error loading quizzes. Please try again.');
    }
}

function updateQuizzesUI() {
    const quizzesList = document.getElementById('quizzesList');
    if (!quizzesList) return;
    
    // Get filter values
    const chapterFilter = document.getElementById('chapterFilter')?.value || '';
    const courseFilter = document.getElementById('quizCourseFilter')?.value || '';
    
    console.log('Filtering quizzes with:', { chapterFilter, courseFilter });
    
    // Filter quizzes
    const filteredQuizzes = quizzes.filter(quiz => {
        const matchesChapter = !chapterFilter || quiz.chapterNumber.toString() === chapterFilter;
        const matchesCourse = !courseFilter || quiz.courseName === courseFilter;
        return matchesChapter && matchesCourse;
    });
    
    quizzesList.innerHTML = '';
    
    if (filteredQuizzes.length === 0) {
        quizzesList.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <p>No quizzes found matching the current filters.</p>
                <p class="mt-2 text-sm">Total quizzes: ${quizzes.length}</p>
            </div>
        `;
        return;
    }
    
    // Group quizzes by course
    const quizzesByCourse = filteredQuizzes.reduce((acc, quiz) => {
        const courseName = quiz.courseName || 'Unassigned Course';
        if (!acc[courseName]) {
            acc[courseName] = [];
        }
        acc[courseName].push(quiz);
        return acc;
    }, {});
    
    // Render quizzes grouped by course
    Object.entries(quizzesByCourse).forEach(([courseName, courseQuizzes]) => {
        const courseSection = document.createElement('div');
        courseSection.className = 'mb-8';
        courseSection.innerHTML = `
            <h3 class="text-xl font-semibold mb-4">${courseName}</h3>
            <div class="space-y-4">
                ${courseQuizzes.map(quiz => `
                    <div class="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
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
                    </div>
                `).join('')}
            </div>
        `;
        quizzesList.appendChild(courseSection);
    });
}

// Quiz management functions
window.createNewQuiz = async function() {
    console.log('=== createNewQuiz called ===');
    console.log('Current courses:', courses);
    console.log('Current quizzes:', quizzes);
    
    currentQuizId = null;
    questionIdCounter = 1;
    
    // Ensure courses are loaded
    if (courses.length === 0) {
        console.log('No courses found, loading courses...');
        await loadCourses();
        console.log('Courses loaded:', courses);
    }
    
    console.log('Calling showQuizBuilder...');
    showQuizBuilder();
};

window.editQuiz = async function(quizId) {
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz) {
        alert('Quiz not found');
        return;
    }
    
    // Ensure courses are loaded
    if (courses.length === 0) {
        await loadCourses();
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
    console.log('=== showQuizBuilder called ===');
    console.log('Quiz parameter:', quiz);
    
    // Get modal element
    const modal = document.getElementById('quizBuilderModal');
    if (!modal) {
        console.error('Modal element not found');
        return;
    }
    
    // Get content container
    const contentContainer = modal.querySelector('#quizBuilderContent');
    if (!contentContainer) {
        console.error('Content container not found');
        return;
    }
    
    // Create form HTML
    const formHTML = `
        <form id="quizForm" class="space-y-4">
            <div>
                <label for="quizTitle" class="block text-sm font-medium text-gray-700">Quiz Title</label>
                <input type="text" id="quizTitle" name="title" required
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                    value="${quiz ? quiz.title : ''}">
            </div>
            <div>
                <label for="courseId" class="block text-sm font-medium text-gray-700">Course</label>
                <select id="courseId" name="courseId" required
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary">
                    <option value="">Select a course</option>
                </select>
            </div>
            <div>
                <label for="chapterNumber" class="block text-sm font-medium text-gray-700">Chapter Number</label>
                <input type="number" id="chapterNumber" name="chapterNumber" min="1" required
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                    value="${quiz ? quiz.chapterNumber : ''}">
            </div>
            <div>
                <label for="quizDescription" class="block text-sm font-medium text-gray-700">Description</label>
                <textarea id="quizDescription" name="description" rows="3"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary">${quiz ? quiz.description : ''}</textarea>
            </div>
            <div id="questionsContainer" class="space-y-4">
                <!-- Questions will be added here -->
            </div>
            <div class="flex justify-between items-center">
                <button type="button" onclick="showQuestionTypeModal()" class="button button-secondary">
                    Add Question
                </button>
                <div class="flex space-x-2">
                    <button type="button" onclick="closeQuizBuilder()" class="button button-secondary">Cancel</button>
                    <button type="submit" class="button button-primary">Save Quiz</button>
                </div>
            </div>
        </form>
    `;
    
    // Set content
    contentContainer.innerHTML = formHTML;
    
    // Show modal
    modal.classList.remove('hidden');
    
    // Get elements after they're created
    const form = document.getElementById('quizForm');
    const courseSelect = document.getElementById('courseId');
    const questionsContainer = document.getElementById('questionsContainer');
    
    if (!form || !courseSelect || !questionsContainer) {
        console.error('Failed to create form elements');
        modal.classList.add('hidden');
        return;
    }
    
    // Set title
    const title = document.getElementById('quizBuilderTitle');
    if (title) {
        title.textContent = quiz ? 'Edit Quiz' : 'Create New Quiz';
    }
    
    // Clear existing options
    courseSelect.innerHTML = '<option value="">Select a course</option>';
    
    // Add "Create New Course" option
    const createCourseOption = document.createElement('option');
    createCourseOption.value = 'new';
    createCourseOption.textContent = '➕ Create New Course';
    courseSelect.appendChild(createCourseOption);
    
    // Add existing courses
    if (courses && courses.length > 0) {
        courses.forEach(course => {
            const option = document.createElement('option');
            option.value = course.id;
            option.textContent = course.name;
            if (quiz && quiz.courseId === course.id) {
                option.selected = true;
            }
            courseSelect.appendChild(option);
        });
    }
    
    // Add event listener for course selection
    courseSelect.addEventListener('change', function(e) {
        if (e.target.value === 'new') {
            showCourseBuilder();
            courseSelect.value = '';
        }
    });
    
    // Clear questions container
    questionsContainer.innerHTML = '';
    
    // Set form values if editing
    if (quiz) {
        form.querySelector('#quizTitle').value = quiz.title;
        form.querySelector('#quizDescription').value = quiz.description || '';
        form.querySelector('#chapterNumber').value = quiz.chapterNumber || '';
        
        // Add existing questions
        if (quiz.questions && quiz.questions.length > 0) {
            quiz.questions.forEach(question => {
                addQuestion(question);
            });
        }
    } else {
        form.reset();
    }
    
    // Add form submit handler
    form.addEventListener('submit', handleQuizSave);
    
    console.log('Quiz builder setup complete');
}

// Make closeQuizBuilder available globally
window.closeQuizBuilder = function() {
    const modal = document.getElementById('quizBuilderModal');
    if (!modal) {
        console.error('Quiz builder modal not found');
        return;
    }
    modal.classList.add('hidden');
    document.getElementById('quizForm').reset();
    document.getElementById('questionsContainer').innerHTML = '';
};

window.showQuestionTypeModal = function() {
    console.log('=== showQuestionTypeModal called ===');
    
    // Get or create modal
    let modal = document.getElementById('questionTypeModal');
    if (!modal) {
        console.log('Creating question type modal...');
        modal = document.createElement('div');
        modal.id = 'questionTypeModal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 hidden';
        modal.innerHTML = `
            <div class="fixed inset-0 flex items-center justify-center p-4">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl">
                    <!-- Header -->
                    <div class="p-6 border-b">
                        <div class="flex justify-between items-center">
                            <h3 class="text-xl font-bold text-gray-900">Select Question Type</h3>
                            <button onclick="closeQuestionTypeModal()" class="text-gray-500 hover:text-gray-700">
                                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Content -->
                    <div class="p-6">
                        <div class="grid grid-cols-2 gap-4">
                            <button onclick="selectQuestionType('multiple-choice')" class="p-4 border rounded-lg hover:bg-gray-50">
                                <h3 class="font-semibold">Multiple Choice</h3>
                                <p class="text-sm text-gray-600">Single correct answer from multiple options</p>
                            </button>
                            <button onclick="selectQuestionType('fill-blank')" class="p-4 border rounded-lg hover:bg-gray-50">
                                <h3 class="font-semibold">Fill in the Blank</h3>
                                <p class="text-sm text-gray-600">Single word or phrase answer</p>
                            </button>
                            <button onclick="selectQuestionType('fill-blank-double')" class="p-4 border rounded-lg hover:bg-gray-50">
                                <h3 class="font-semibold">Double Fill in the Blank</h3>
                                <p class="text-sm text-gray-600">Two related answers</p>
                            </button>
                            <button onclick="selectQuestionType('true-false')" class="p-4 border rounded-lg hover:bg-gray-50">
                                <h3 class="font-semibold">True/False</h3>
                                <p class="text-sm text-gray-600">Binary choice question</p>
                            </button>
                            <button onclick="selectQuestionType('short-answer')" class="p-4 border rounded-lg hover:bg-gray-50">
                                <h3 class="font-semibold">Short Answer</h3>
                                <p class="text-sm text-gray-600">Brief written response</p>
                            </button>
                            <button onclick="selectQuestionType('long-answer')" class="p-4 border rounded-lg hover:bg-gray-50">
                                <h3 class="font-semibold">Long Answer</h3>
                                <p class="text-sm text-gray-600">Detailed written response</p>
                            </button>
                            <button onclick="selectQuestionType('profile-strategy')" class="p-4 border rounded-lg hover:bg-gray-50">
                                <h3 class="font-semibold">Profile & Strategy</h3>
                                <p class="text-sm text-gray-600">Match profiles with strategies</p>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Show modal
    modal.classList.remove('hidden');
}

window.closeQuestionTypeModal = function() {
    const modal = document.getElementById('questionTypeModal');
    if (!modal) {
        console.error('Question type modal not found');
        return;
    }
    modal.classList.add('hidden');
}

window.selectQuestionType = function(type) {
    console.log('=== selectQuestionType called ===');
    console.log('Selected type:', type);
    currentQuestionType = type;
    closeQuestionTypeModal();
    addQuestion();
}

window.addQuestion = function(existingQuestion = null) {
    console.log('=== addQuestion called ===');
    console.log('Question type:', existingQuestion?.type || currentQuestionType);
    
    const container = document.getElementById('questionsContainer');
    if (!container) {
        console.error('Questions container not found');
        return;
    }

    const questionType = existingQuestion?.type || currentQuestionType || 'multiple-choice';
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
    console.log('Question added successfully');
};

window.removeQuestion = function(button) {
    const questionDiv = button.closest('.question-builder');
    if (questionDiv) {
        questionDiv.remove();
        updateQuestionNumbers();
    }
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
    const courseId = formData.get('courseId');
    const chapterNumber = parseInt(formData.get('chapterNumber'));
    const title = formData.get('title');
    
    console.log('Saving quiz with data:', {
        courseId,
        chapterNumber,
        title,
        formData: Object.fromEntries(formData)
    });
    
    // Get course name
    const course = courses.find(c => c.id === courseId);
    if (!course) {
        alert('Please select a valid course');
        return;
    }
    
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
        courseId: courseId,
        courseName: course.name,
        chapterNumber: chapterNumber,
        title: title,
        description: formData.get('description'),
        questions: questions,
        updatedAt: serverTimestamp()
    };
    
    console.log('Final quiz data to save:', quizData);
    
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

// Load dashboard data
async function loadDashboardData() {
    try {
        console.log('Loading dashboard data...');
        const submissionsRef = collection(db, 'quiz_submissions');
        const q = query(submissionsRef, orderBy('submittedAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        console.log('Received snapshot with', querySnapshot.size, 'documents');
        
        submissions = []; // Reset submissions array
        let pendingCount = 0;
        let gradedCount = 0;
        const uniqueCourses = new Set(); // Track unique courses
        const uniqueChapters = new Set(); // Track unique chapters
        
        querySnapshot.forEach((doc) => {
            const submission = {
                id: doc.id,
                ...doc.data()
            };
            console.log('Processing submission:', {
                id: submission.id,
                status: submission.status,
                email: submission.userEmail,
                course: submission.courseName,
                chapter: submission.chapterNumber
            });
            submissions.push(submission);
            
            // Add course to unique courses set
            if (submission.courseName) {
                uniqueCourses.add(submission.courseName);
            }
            
            // Add chapter to unique chapters set
            if (submission.chapterNumber) {
                uniqueChapters.add(submission.chapterNumber);
            }
            
            if (submission.status === 'pending_review') {
                pendingCount++;
            } else if (submission.status === 'graded') {
                gradedCount++;
            }
        });
        
        console.log('Submission counts:', { 
            total: submissions.length, 
            pending: pendingCount, 
            graded: gradedCount,
            courses: Array.from(uniqueCourses),
            chapters: Array.from(uniqueChapters)
        });
        
        // Update course filter options
        const courseFilter = document.getElementById('courseFilter');
        if (courseFilter) {
            const options = Array.from(uniqueCourses).map(course => 
                `<option value="${course}">${course}</option>`
            );
            courseFilter.innerHTML = `
                <option value="">All Courses</option>
                ${options.join('')}
            `;
        }
        
        // Update chapter filter options
        const chapterFilter = document.getElementById('chapterFilter');
        if (chapterFilter) {
            const options = Array.from(uniqueChapters)
                .sort((a, b) => a - b)
                .map(chapter => `<option value="${chapter}">Chapter ${chapter}</option>`);
            chapterFilter.innerHTML = `
                <option value="">All Chapters</option>
                ${options.join('')}
            `;
        }
        
        updateSubmissionsUI();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        alert('Error loading dashboard data. Please try again.');
    }
}

function updateSubmissionsUI() {
    console.log('updateSubmissionsUI called');
    const submissionsList = document.getElementById('submissionsList');
    if (!submissionsList) {
        console.error('Submissions list element not found');
        return;
    }
    
    submissionsList.innerHTML = '';
    
    // Get filter values
    const searchEmail = document.getElementById('searchEmail')?.value.toLowerCase() || '';
    const viewFilter = document.getElementById('viewFilter')?.value || 'pending';
    const courseFilter = document.getElementById('courseFilter')?.value || '';
    const chapterFilter = document.getElementById('chapterFilter')?.value || '';
    
    console.log('Filtering with:', { 
        searchEmail, 
        viewFilter, 
        courseFilter, 
        chapterFilter,
        chapterFilterType: typeof chapterFilter,
        chapterFilterValue: chapterFilter
    });
    console.log('Total submissions before filtering:', submissions.length);
    
    // Filter submissions
    const filteredSubmissions = submissions.filter(submission => {
        const matchesEmail = submission.userEmail.toLowerCase().includes(searchEmail);
        const matchesView = viewFilter === 'pending' ? 
            submission.status === 'pending_review' : 
            submission.status === 'graded';
        const matchesCourse = !courseFilter || submission.courseName === courseFilter;
        
        // Convert both to numbers for comparison
        const submissionChapter = Number(submission.chapterNumber);
        const filterChapter = Number(chapterFilter);
        const matchesChapter = !chapterFilter || submissionChapter === filterChapter;
        
        console.log('Checking submission:', {
            id: submission.id,
            email: submission.userEmail,
            status: submission.status,
            course: submission.courseName,
            chapter: submissionChapter,
            filterChapter: filterChapter,
            matches: { 
                matchesEmail, 
                matchesView, 
                matchesCourse, 
                matchesChapter,
                chapterMatch: submissionChapter === filterChapter
            }
        });
        
        return matchesEmail && matchesView && matchesCourse && matchesChapter;
    });
    
    console.log('Filtered submissions:', filteredSubmissions.length);
    
    // Update stats
    const totalSubmissions = submissions.length;
    const pendingSubmissions = submissions.filter(s => s.status === 'pending_review').length;
    const gradedSubmissions = submissions.filter(s => s.status === 'graded').length;
    
    console.log('Stats:', { totalSubmissions, pendingSubmissions, gradedSubmissions });
    
    document.getElementById('totalSubmissions').textContent = totalSubmissions;
    document.getElementById('pendingSubmissions').textContent = pendingSubmissions;
    document.getElementById('gradedSubmissions').textContent = gradedSubmissions;
    
    // Render submissions
    if (filteredSubmissions.length === 0) {
        submissionsList.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <p>No submissions found matching the current filters.</p>
                <p class="mt-2 text-sm">Total submissions: ${totalSubmissions}</p>
                <p class="text-sm">Pending: ${pendingSubmissions}</p>
                <p class="text-sm">Graded: ${gradedSubmissions}</p>
                <p class="text-sm">Current filters:</p>
                <p class="text-sm">- Status: ${viewFilter}</p>
                <p class="text-sm">- Course: ${courseFilter || 'All'}</p>
                <p class="text-sm">- Chapter: ${chapterFilter || 'All'}</p>
                <p class="text-sm">- Email search: ${searchEmail || 'None'}</p>
            </div>
        `;
        return;
    }
    
    filteredSubmissions.forEach(submission => {
        const row = document.createElement('div');
        row.className = 'p-4 border border-gray-200 rounded-lg hover:bg-gray-50';
        
        const statusClass = submission.status === 'pending_review' ? 'text-yellow-600' : 'text-green-600';
        const statusText = submission.status === 'pending_review' ? 'Pending Review' : 'Graded';
        
        row.innerHTML = `
            <div class="flex justify-between items-center">
                <div class="flex-1">
                    <h4 class="text-lg font-semibold">${submission.userName || 'Unknown User'}</h4>
                    <p class="text-sm text-gray-600">${submission.userEmail || 'No Email'}</p>
                </div>
                <div class="flex-1">
                    <p class="text-gray-700">${submission.courseName || 'No Course'}</p>
                    <p class="text-sm text-gray-600">Chapter ${submission.chapterNumber || 'N/A'}: ${submission.chapterTitle || 'No Title'}</p>
                    <p class="text-sm text-gray-600">Score: ${submission.score}/${submission.maxScore || 0} (${submission.percentage || 0}%)</p>
                </div>
                <div class="flex-1">
                    <span class="${statusClass}">${statusText}</span>
                    <p class="text-sm text-gray-500">${submission.submittedAt?.toDate().toLocaleString() || 'No date'}</p>
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
                <p>Course: ${submission.courseName}</p>
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
                <p>Course: ${submission.courseName}</p>
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
    doc.text(`Course: ${currentSubmission.courseName}`, 20, 50);
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
    doc.save(`quiz_submission_${currentSubmission.userName}_${currentSubmission.courseName}.pdf`);
};

// Close modal
window.closeModal = function() {
    document.getElementById('submissionModal').classList.add('hidden');
    currentSubmission = null;
};

// Handle login form
document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Login form submitted');
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        console.log('Attempting to sign in with:', email);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('Sign in successful:', userCredential.user.uid);
    } catch (error) {
        console.error('Login error:', error);
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
    console.log('=== DOM Content Loaded ===');
    console.log('Setting up event listeners...');
    
    // View filter
    const viewFilter = document.getElementById('viewFilter');
    if (viewFilter) {
        console.log('Setting up view filter listener');
        viewFilter.addEventListener('change', function() {
            console.log('View filter changed:', this.value);
            updateSubmissionsUI();
        });
    }
    
    // Course filter
    const courseFilter = document.getElementById('courseFilter');
    if (courseFilter) {
        console.log('Setting up course filter listener');
        courseFilter.addEventListener('change', function() {
            console.log('Course filter changed:', this.value);
            updateSubmissionsUI();
        });
    }
    
    // Chapter filter
    const chapterFilter = document.getElementById('chapterFilter');
    if (chapterFilter) {
        console.log('Setting up chapter filter listener');
        chapterFilter.addEventListener('change', function() {
            console.log('Chapter filter changed:', this.value);
            updateSubmissionsUI();
        });
    }
    
    // Search input
    const searchInput = document.getElementById('searchEmail');
    if (searchInput) {
        console.log('Setting up search input listener');
        searchInput.addEventListener('input', function() {
            console.log('Search input changed:', this.value);
            updateSubmissionsUI();
        });
    }

    // Quiz form
    const quizForm = document.getElementById('quizForm');
    if (quizForm) {
        console.log('Setting up quiz form listener');
        quizForm.addEventListener('submit', handleQuizSave);
    } else {
        console.error('Quiz form not found');
    }

    // Course form
    const courseForm = document.getElementById('courseForm');
    if (courseForm) {
        console.log('Setting up course form listener');
        courseForm.addEventListener('submit', handleCourseSave);
    } else {
        console.error('Course form not found');
    }

    // Log all elements with IDs
    console.log('=== All Elements with IDs ===');
    document.querySelectorAll('[id]').forEach(el => {
        console.log(`Element ID: ${el.id}, Tag: ${el.tagName}`);
    });
});

// Make functions available globally
window.loadCourses = function() {
    loadCourses();
};

// Add event listeners for form submissions
document.addEventListener('DOMContentLoaded', function() {
    const quizForm = document.getElementById('quizForm');
    const courseForm = document.getElementById('courseForm');

    if (quizForm) {
        quizForm.addEventListener('submit', handleQuizSave);
    }

    if (courseForm) {
        courseForm.addEventListener('submit', handleCourseSave);
    }
});