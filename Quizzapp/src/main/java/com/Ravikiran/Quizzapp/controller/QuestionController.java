package com.Ravikiran.Quizzapp.controller;



import com.Ravikiran.Quizzapp.model.Question;
import com.Ravikiran.Quizzapp.service.QuestionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("question")
@CrossOrigin
public class QuestionController {



    @Autowired
    QuestionService questionService;


    @GetMapping("allQuestions")
    public ResponseEntity<List<Question>> getAllQuestions(){
        return questionService.getAllQuestions();
    }

    @GetMapping("category/{category}")
    public ResponseEntity<List<Question>> getAllQuestionsByCategory(@PathVariable String category)
    {
        return questionService.getAllQuestionsByCategory(category);
    }

    @PostMapping("add")
    public ResponseEntity<String> addQuestion(@RequestBody Question question)
    {
       return questionService.addQuestion(question);
    }

}
