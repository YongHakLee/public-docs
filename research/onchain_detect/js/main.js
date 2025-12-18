/**
 * 블록체인 이상징후 탐지 연구 보고서 - JavaScript
 * 기능: TOC 하이라이트, 스무스 스크롤, 다크 모드 토글, 모바일 TOC
 */

(function() {
    'use strict';

    // ==========================================================================
    // 1. 다크 모드 토글
    // ==========================================================================
    function initThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        const STORAGE_KEY = 'theme-preference';

        // 저장된 테마 또는 시스템 설정 확인
        function getThemePreference() {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                return stored;
            }
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        // 테마 적용
        function setTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem(STORAGE_KEY, theme);
        }

        // 초기 테마 설정
        const initialTheme = getThemePreference();
        setTheme(initialTheme);

        // 토글 버튼 클릭
        if (themeToggle) {
            themeToggle.addEventListener('click', function() {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                setTheme(newTheme);
            });
        }

        // 시스템 테마 변경 감지
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
            if (!localStorage.getItem(STORAGE_KEY)) {
                setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    // ==========================================================================
    // 2. 목차 (TOC) 활성 상태 관리 (Intersection Observer)
    // ==========================================================================
    function initTocHighlight() {
        const sections = document.querySelectorAll('.report__section, .report__subsection, .report__subsubsection');
        const tocLinks = document.querySelectorAll('.toc__link');

        if (sections.length === 0 || tocLinks.length === 0) return;

        // 현재 활성 링크 추적
        let activeLink = null;

        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    const correspondingLink = document.querySelector('.toc__link[href="#' + id + '"]');

                    if (correspondingLink) {
                        // 이전 활성 링크 제거
                        if (activeLink) {
                            activeLink.classList.remove('active');
                        }

                        // 새 활성 링크 설정
                        correspondingLink.classList.add('active');
                        activeLink = correspondingLink;

                        // 사이드바에서 활성 항목이 보이도록 스크롤
                        const toc = document.getElementById('toc');
                        if (toc && window.innerWidth >= 1200) {
                            const linkRect = correspondingLink.getBoundingClientRect();
                            const tocRect = toc.getBoundingClientRect();

                            if (linkRect.top < tocRect.top || linkRect.bottom > tocRect.bottom) {
                                correspondingLink.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'center'
                                });
                            }
                        }
                    }
                }
            });
        }, {
            rootMargin: '-10% 0px -80% 0px',
            threshold: 0
        });

        sections.forEach(function(section) {
            observer.observe(section);
        });
    }

    // ==========================================================================
    // 3. 스무스 스크롤
    // ==========================================================================
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
            anchor.addEventListener('click', function(e) {
                const href = this.getAttribute('href');

                // # 만 있는 경우 스킵
                if (href === '#') return;

                const target = document.querySelector(href);

                if (target) {
                    e.preventDefault();

                    // 모바일에서 TOC 닫기
                    closeMobileToc();

                    // 스크롤
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });

                    // URL 해시 업데이트
                    history.pushState(null, null, href);
                }
            });
        });
    }

    // ==========================================================================
    // 4. 모바일 TOC 토글
    // ==========================================================================
    function initMobileToc() {
        const tocToggle = document.getElementById('tocToggle');
        const tocClose = document.getElementById('tocClose');
        const toc = document.getElementById('toc');
        const tocOverlay = document.getElementById('tocOverlay');

        if (!tocToggle || !toc) return;

        // TOC 열기
        tocToggle.addEventListener('click', function() {
            toc.classList.add('toc--open');
            if (tocOverlay) {
                tocOverlay.classList.add('toc-overlay--visible');
            }
            document.body.style.overflow = 'hidden';
        });

        // TOC 닫기 버튼
        if (tocClose) {
            tocClose.addEventListener('click', closeMobileToc);
        }

        // 오버레이 클릭으로 닫기
        if (tocOverlay) {
            tocOverlay.addEventListener('click', closeMobileToc);
        }

        // ESC 키로 닫기
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && toc.classList.contains('toc--open')) {
                closeMobileToc();
            }
        });
    }

    function closeMobileToc() {
        const toc = document.getElementById('toc');
        const tocOverlay = document.getElementById('tocOverlay');

        if (toc) {
            toc.classList.remove('toc--open');
        }
        if (tocOverlay) {
            tocOverlay.classList.remove('toc-overlay--visible');
        }
        document.body.style.overflow = '';
    }

    // ==========================================================================
    // 5. 페이지 로드 시 해시 위치로 스크롤
    // ==========================================================================
    function scrollToHash() {
        if (window.location.hash) {
            const target = document.querySelector(window.location.hash);
            if (target) {
                // 약간의 지연 후 스크롤 (CSS 로딩 대기)
                setTimeout(function() {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }, 100);
            }
        }
    }

    // ==========================================================================
    // 6. 테이블 반응형 래퍼 (이미 HTML에 포함되어 있으므로 스킵)
    // ==========================================================================

    // ==========================================================================
    // 7. 외부 링크에 아이콘 추가 (선택사항)
    // ==========================================================================
    function markExternalLinks() {
        const externalLinks = document.querySelectorAll('a[target="_blank"]');
        externalLinks.forEach(function(link) {
            // 이미 처리된 링크 스킵
            if (link.querySelector('.external-icon')) return;

            // 외부 링크 아이콘 추가
            const icon = document.createElement('span');
            icon.className = 'external-icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = ' ↗';
            link.appendChild(icon);
        });
    }

    // ==========================================================================
    // 초기화
    // ==========================================================================
    document.addEventListener('DOMContentLoaded', function() {
        initThemeToggle();
        initTocHighlight();
        initSmoothScroll();
        initMobileToc();
        scrollToHash();
        markExternalLinks();
    });

    // 페이지가 이미 로드된 경우 (캐시된 페이지)
    if (document.readyState === 'complete') {
        initThemeToggle();
        initTocHighlight();
        initSmoothScroll();
        initMobileToc();
        scrollToHash();
        markExternalLinks();
    }
})();
